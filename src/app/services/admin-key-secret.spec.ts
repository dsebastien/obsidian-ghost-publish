import { describe, expect, test } from 'bun:test'
import {
    DEFAULT_ADMIN_KEY_SECRET_NAME,
    LEGACY_ADMIN_KEY_GRACE_PERIOD_MS,
    bootstrapAdminKey,
    claimSecretName,
    readAdminKey,
    readSecret
} from './admin-key-secret'
import type { AdminKeyFields, SecretStore } from './admin-key-secret'

/** In-memory SecretStorage fake; rejects ids SecretStorage would refuse. */
function fakeSecretStore(initial: Record<string, string> = {}): SecretStore & {
    secrets: Map<string, string>
    writes: number
} {
    const secrets = new Map(Object.entries(initial))
    const store = {
        secrets,
        writes: 0,
        getSecret: (id: string): string | null => secrets.get(id) ?? null,
        setSecret: (id: string, value: string): void => {
            if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) throw new Error(`Invalid id: ${id}`)
            store.writes += 1
            secrets.set(id, value)
        }
    }
    return store
}

const NOW = new Date('2026-10-03T00:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000

function legacyFields(extra: Partial<AdminKeyFields> = {}): AdminKeyFields {
    return {
        ghostAdminKeySecretName: DEFAULT_ADMIN_KEY_SECRET_NAME,
        ghostAdminKey: 'id:abc',
        ...extra
    }
}

describe('DEFAULT_ADMIN_KEY_SECRET_NAME', () => {
    test('is a valid SecretStorage id prefixed with the plugin id', () => {
        expect(DEFAULT_ADMIN_KEY_SECRET_NAME).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
        expect(DEFAULT_ADMIN_KEY_SECRET_NAME.startsWith('ghost-publish-')).toBe(true)
    })
})

describe('readSecret', () => {
    test('returns the trimmed value', () => {
        expect(readSecret(fakeSecretStore({ a: ' id:secret ' }), 'a')).toBe('id:secret')
    })
    test('treats a missing secret, an empty value, an empty name or no store as absent', () => {
        expect(readSecret(fakeSecretStore(), 'missing')).toBe('')
        expect(readSecret(fakeSecretStore({ a: '' }), 'a')).toBe('')
        expect(readSecret(fakeSecretStore({ a: 'x' }), '  ')).toBe('')
        expect(readSecret(undefined, 'a')).toBe('')
    })
})

describe('claimSecretName', () => {
    test('uses the configured name when free', () => {
        const store = fakeSecretStore()
        expect(claimSecretName(store, 'id:abc', DEFAULT_ADMIN_KEY_SECRET_NAME)).toBe(
            DEFAULT_ADMIN_KEY_SECRET_NAME
        )
        expect(store.secrets.get(DEFAULT_ADMIN_KEY_SECRET_NAME)).toBe('id:abc')
    })
    test('reuses a slot already holding the value, without writing', () => {
        const store = fakeSecretStore({ [DEFAULT_ADMIN_KEY_SECRET_NAME]: 'id:abc' })
        expect(claimSecretName(store, 'id:abc', DEFAULT_ADMIN_KEY_SECRET_NAME)).toBe(
            DEFAULT_ADMIN_KEY_SECRET_NAME
        )
        expect(store.writes).toBe(0)
    })
    test('never overwrites a different secret: suffixes instead', () => {
        const store = fakeSecretStore({
            [DEFAULT_ADMIN_KEY_SECRET_NAME]: 'a:1',
            [`${DEFAULT_ADMIN_KEY_SECRET_NAME}-2`]: 'b:2'
        })
        expect(claimSecretName(store, 'id:abc', DEFAULT_ADMIN_KEY_SECRET_NAME)).toBe(
            `${DEFAULT_ADMIN_KEY_SECRET_NAME}-3`
        )
        expect(store.secrets.get(DEFAULT_ADMIN_KEY_SECRET_NAME)).toBe('a:1')
    })
})

describe('bootstrapAdminKey', () => {
    test('no legacy field: no-op', () => {
        const store = fakeSecretStore()
        const fields: AdminKeyFields = { ghostAdminKeySecretName: DEFAULT_ADMIN_KEY_SECRET_NAME }
        expect(bootstrapAdminKey(store, fields, NOW)).toBe(false)
        expect(store.writes).toBe(0)
    })

    test('an empty legacy field is dropped', () => {
        const fields = legacyFields({ ghostAdminKey: '  ' })
        expect(bootstrapAdminKey(fakeSecretStore(), fields, NOW)).toBe(true)
        expect(fields).not.toHaveProperty('ghostAdminKey')
    })

    test('first migration copies the key, records the date and KEEPS the legacy copy', () => {
        const store = fakeSecretStore()
        const fields = legacyFields()
        expect(bootstrapAdminKey(store, fields, NOW)).toBe(true)
        expect(store.secrets.get(DEFAULT_ADMIN_KEY_SECRET_NAME)).toBe('id:abc')
        expect(fields.legacySecretMigratedAt).toBe(NOW.toISOString())
        expect(fields.ghostAdminKey).toBe('id:abc')
    })

    test('first migration never overwrites a different secret', () => {
        const store = fakeSecretStore({ [DEFAULT_ADMIN_KEY_SECRET_NAME]: 'other:key' })
        const fields = legacyFields()
        bootstrapAdminKey(store, fields, NOW)
        expect(store.secrets.get(DEFAULT_ADMIN_KEY_SECRET_NAME)).toBe('other:key')
        expect(fields.ghostAdminKeySecretName).toBe(`${DEFAULT_ADMIN_KEY_SECRET_NAME}-2`)
        expect(store.secrets.get(fields.ghostAdminKeySecretName)).toBe('id:abc')
    })

    test('an empty secret name falls back to the default', () => {
        const store = fakeSecretStore()
        const fields = legacyFields({ ghostAdminKeySecretName: '' })
        bootstrapAdminKey(store, fields, NOW)
        expect(fields.ghostAdminKeySecretName).toBe(DEFAULT_ADMIN_KEY_SECRET_NAME)
    })

    test('device B (already migrated elsewhere, empty storage here) gets the key', () => {
        const store = fakeSecretStore()
        const fields = legacyFields({ legacySecretMigratedAt: NOW.toISOString() })
        expect(bootstrapAdminKey(store, fields, new Date(NOW.getTime() + DAY))).toBe(false)
        expect(store.secrets.get(DEFAULT_ADMIN_KEY_SECRET_NAME)).toBe('id:abc')
        expect(fields.ghostAdminKey).toBe('id:abc')
    })

    test('is idempotent: a secret already set on this device is left alone', () => {
        const store = fakeSecretStore({ [DEFAULT_ADMIN_KEY_SECRET_NAME]: 'newer:key' })
        const fields = legacyFields({ legacySecretMigratedAt: NOW.toISOString() })
        bootstrapAdminKey(store, fields, NOW)
        bootstrapAdminKey(store, fields, NOW)
        expect(store.writes).toBe(0)
        expect(store.secrets.get(DEFAULT_ADMIN_KEY_SECRET_NAME)).toBe('newer:key')
    })

    test('drops the legacy copy once the 60-day grace period is over', () => {
        const store = fakeSecretStore()
        const fields = legacyFields({ legacySecretMigratedAt: NOW.toISOString() })
        const justBefore = new Date(NOW.getTime() + LEGACY_ADMIN_KEY_GRACE_PERIOD_MS - 1)
        expect(bootstrapAdminKey(store, fields, justBefore)).toBe(false)
        expect(fields.ghostAdminKey).toBe('id:abc')

        const after = new Date(NOW.getTime() + 60 * DAY)
        expect(bootstrapAdminKey(store, fields, after)).toBe(true)
        expect(fields).not.toHaveProperty('ghostAdminKey')
        // This device still got its copy before the purge.
        expect(store.secrets.get(DEFAULT_ADMIN_KEY_SECRET_NAME)).toBe('id:abc')
    })

    test('a SecretStorage failure keeps the legacy copy', () => {
        const store = fakeSecretStore()
        store.setSecret = (): void => {
            throw new Error('denied')
        }
        const fields = legacyFields()
        expect(bootstrapAdminKey(store, fields, NOW)).toBe(false)
        expect(fields.ghostAdminKey).toBe('id:abc')
        expect(fields.legacySecretMigratedAt).toBeUndefined()
    })
})

describe('readAdminKey', () => {
    test('prefers SecretStorage', () => {
        const store = fakeSecretStore({ [DEFAULT_ADMIN_KEY_SECRET_NAME]: 'new:key' })
        expect(readAdminKey(store, legacyFields())).toBe('new:key')
    })
    test('falls back to the legacy copy and migrates it on the spot', () => {
        const store = fakeSecretStore()
        expect(readAdminKey(store, legacyFields())).toBe('id:abc')
        expect(store.secrets.get(DEFAULT_ADMIN_KEY_SECRET_NAME)).toBe('id:abc')
    })
    test('empty when neither is set', () => {
        expect(
            readAdminKey(fakeSecretStore(), {
                ghostAdminKeySecretName: DEFAULT_ADMIN_KEY_SECRET_NAME
            })
        ).toBe('')
    })
})
