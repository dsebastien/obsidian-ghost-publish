import { describe, expect, mock, test } from 'bun:test'
import { produce } from 'immer'
import type { App, SecretStorage } from 'obsidian'
import { GhostPublishPlugin } from './plugin'
import { createDefaultSettings } from './types/plugin-settings.intf'
import { DEFAULT_ADMIN_KEY_SECRET_NAME } from './services/admin-key-secret'
import { resolveAdminKey } from './services/publish-service'

/**
 * Admin key lifecycle across synced devices: data.json is shared, each
 * device has its own SecretStorage.
 */

type Disk = Record<string, unknown> | null

interface Device {
    plugin: GhostPublishPlugin
    secrets: Map<string, string>
    saves: number
}

/** A device sharing `vault.disk` (the synced data.json) with the others. */
function createDevice(vault: { disk: Disk }, secretsInit: Record<string, string> = {}): Device {
    const secrets = new Map(Object.entries(secretsInit))
    const counter = { saves: 0 }
    const secretStorage = {
        getSecret: (id: string): string | null => secrets.get(id) ?? null,
        setSecret: (id: string, value: string): void => {
            secrets.set(id, value)
        }
    } as SecretStorage
    const app = { secretStorage } as App
    const plugin = Object.assign(
        Object.create(GhostPublishPlugin.prototype) as GhostPublishPlugin,
        {
            app,
            settingsWriteChain: Promise.resolve(),
            settings: produce(createDefaultSettings(), () => {}),
            loadData: (): Promise<unknown> =>
                Promise.resolve(vault.disk === null ? null : structuredClone(vault.disk)),
            saveData: mock((data: unknown): Promise<void> => {
                counter.saves += 1
                vault.disk = structuredClone(data) as Record<string, unknown>
                return Promise.resolve()
            })
        }
    )
    return {
        plugin,
        secrets,
        get saves(): number {
            return counter.saves
        }
    }
}

function withoutEnvKey(fn: () => void): void {
    const prev = process.env['GHOST_ADMIN_KEY']
    delete process.env['GHOST_ADMIN_KEY']
    try {
        fn()
    } finally {
        if (prev !== undefined) process.env['GHOST_ADMIN_KEY'] = prev
    }
}

const LEGACY_DISK = { ghostUrl: 'https://blog.example.com', ghostAdminKey: 'id:abc' }

describe('admin key across devices', () => {
    test('device A migrates and keeps the plain-text copy for the other devices', async () => {
        const vault: { disk: Disk } = { disk: { ...LEGACY_DISK } }
        const a = createDevice(vault)
        await a.plugin.loadSettings()

        expect(a.secrets.get(DEFAULT_ADMIN_KEY_SECRET_NAME)).toBe('id:abc')
        expect(vault.disk?.['ghostAdminKey']).toBe('id:abc')
        expect(vault.disk?.['ghostAdminKeySecretName']).toBe(DEFAULT_ADMIN_KEY_SECRET_NAME)
        expect(typeof vault.disk?.['legacySecretMigratedAt']).toBe('string')
        expect(resolveAdminKey(a.plugin.app, a.plugin.settings)).toBe('id:abc')
    })

    test('device B loading the synced data.json with empty storage migrates and works', async () => {
        const vault: { disk: Disk } = { disk: { ...LEGACY_DISK } }
        await createDevice(vault).plugin.loadSettings()
        const migratedAt = vault.disk?.['legacySecretMigratedAt']

        const b = createDevice(vault)
        await b.plugin.loadSettings()

        expect(b.secrets.get(DEFAULT_ADMIN_KEY_SECRET_NAME)).toBe('id:abc')
        expect(resolveAdminKey(b.plugin.app, b.plugin.settings)).toBe('id:abc')
        // The grace period is not restarted by later devices.
        expect(vault.disk?.['legacySecretMigratedAt']).toBe(migratedAt)
        expect(b.saves).toBe(0)
    })

    test('reloading is idempotent', async () => {
        const vault: { disk: Disk } = { disk: { ...LEGACY_DISK } }
        const a = createDevice(vault)
        await a.plugin.loadSettings()
        await a.plugin.loadSettings()
        await a.plugin.loadSettings()
        expect(a.saves).toBe(1)
        expect(a.secrets.size).toBe(1)
    })

    test('rotating (picking another secret) removes the legacy copy', async () => {
        const vault: { disk: Disk } = { disk: { ...LEGACY_DISK } }
        const a = createDevice(vault, { 'my-new-key': 'id:new' })
        await a.plugin.loadSettings()
        await a.plugin.setAdminKeySecretName('my-new-key')

        expect(vault.disk).not.toHaveProperty('ghostAdminKey')
        expect(vault.disk?.['ghostAdminKeySecretName']).toBe('my-new-key')
        expect(resolveAdminKey(a.plugin.app, a.plugin.settings)).toBe('id:new')
        expect(JSON.stringify(vault.disk)).not.toContain('id:new')
    })

    test('forget key clears this device’s secret and the legacy copy', async () => {
        const vault: { disk: Disk } = { disk: { ...LEGACY_DISK } }
        const a = createDevice(vault)
        await a.plugin.loadSettings()
        await a.plugin.forgetAdminKey()

        expect(a.secrets.get(DEFAULT_ADMIN_KEY_SECRET_NAME)).toBe('')
        expect(vault.disk).not.toHaveProperty('ghostAdminKey')
        withoutEnvKey(() => {
            expect(resolveAdminKey(a.plugin.app, a.plugin.settings)).toBe('')
        })
    })

    test('the 60-day purge removes the legacy copy on load', async () => {
        const old = new Date(Date.now() - 61 * 24 * 60 * 60 * 1000).toISOString()
        const vault: { disk: Disk } = {
            disk: { ...LEGACY_DISK, legacySecretMigratedAt: old }
        }
        const a = createDevice(vault)
        await a.plugin.loadSettings()

        expect(vault.disk).not.toHaveProperty('ghostAdminKey')
        expect(a.secrets.get(DEFAULT_ADMIN_KEY_SECRET_NAME)).toBe('id:abc')
        expect(resolveAdminKey(a.plugin.app, a.plugin.settings)).toBe('id:abc')
    })

    test('"Remove plain-text copy now" drops it and keeps this device working', async () => {
        const vault: { disk: Disk } = {
            disk: { ...LEGACY_DISK, legacySecretMigratedAt: new Date().toISOString() }
        }
        const b = createDevice(vault)
        // Simulate a device whose storage was not populated yet.
        b.plugin.settings = produce(b.plugin.settings, (d) => {
            d.ghostAdminKey = 'id:abc'
        })
        await b.plugin.removeLegacyAdminKeyCopy()

        expect(vault.disk).not.toHaveProperty('ghostAdminKey')
        expect(b.secrets.get(DEFAULT_ADMIN_KEY_SECRET_NAME)).toBe('id:abc')
        expect(resolveAdminKey(b.plugin.app, b.plugin.settings)).toBe('id:abc')
    })

    test('a missing secret with no legacy copy resolves empty (never regenerated)', () => {
        const vault: { disk: Disk } = { disk: null }
        const c = createDevice(vault)
        withoutEnvKey(() => {
            expect(resolveAdminKey(c.plugin.app, c.plugin.settings)).toBe('')
        })
        expect(c.secrets.size).toBe(0)
    })
})
