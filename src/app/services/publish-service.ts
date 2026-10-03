import type { App } from 'obsidian'
import type { PluginSettings } from '../types/plugin-settings.intf'
import type { Preset } from '../types/preset.intf'
import { GhostApiClient } from '../api/ghost-api-client'
import { syncNote } from './sync-note'
import { findQueuedNotesForPreset } from './candidate-discovery'
import { regenerateListingNote } from './news-feed-writer'
import { emptySummary } from '../types/sync-result.intf'
import type { SyncResult, SyncSummary } from '../types/sync-result.intf'
import { log } from '../../utils/log'
import { readAdminKey } from './admin-key-secret'

/**
 * Resolve the Ghost Admin key at use time: the SecretStorage entry named in
 * settings first, the legacy plain-text copy (grace period) second, the
 * GHOST_ADMIN_KEY environment variable last. Trims whitespace. Never cached.
 */
export function resolveAdminKey(app: App, settings: PluginSettings): string {
    const key = readAdminKey(app.secretStorage, settings)
    if (key) return key
    const env =
        typeof process !== 'undefined' && process.env ? (process.env['GHOST_ADMIN_KEY'] ?? '') : ''
    return env.trim()
}

/**
 * Label for a missing admin key. SecretStorage is device-local, so a vault
 * synced from another device carries the secret name but not its value: say
 * which secret to set on this device.
 */
export function missingAdminKeyLabel(settings: PluginSettings): string {
    const name = settings.ghostAdminKeySecretName.trim()
    return name
        ? `Ghost Admin API key (secret "${name}" is not set on this device)`
        : 'Ghost Admin API key'
}

export class MissingGhostConfigError extends Error {
    constructor(missing: string[]) {
        super(`Missing Ghost configuration: ${missing.join(', ')}`)
        this.name = 'MissingGhostConfigError'
    }
}

export function buildGhostClient(app: App, settings: PluginSettings): GhostApiClient {
    const missing: string[] = []
    if (!settings.ghostUrl.trim()) missing.push('Ghost URL')
    const key = resolveAdminKey(app, settings)
    if (!key) missing.push(missingAdminKeyLabel(settings))
    if (missing.length > 0) {
        throw new MissingGhostConfigError(missing)
    }
    return new GhostApiClient(settings.ghostUrl.trim(), key)
}

/**
 * Sync every queued note for a given preset. Errors per note are captured
 * into a SyncResult; one failure doesn't stop the others. Regenerates the
 * preset's listing note if enabled.
 */
export async function publishAllForPreset(
    app: App,
    settings: PluginSettings,
    preset: Preset,
    onProgress?: (current: number, total: number, lastResult: SyncResult) => void
): Promise<{ results: SyncResult[]; summary: SyncSummary }> {
    const client = buildGhostClient(app, settings)
    const queue = findQueuedNotesForPreset(app, settings, preset.id)
    const summary = emptySummary()
    const results: SyncResult[] = []

    for (let i = 0; i < queue.length; i++) {
        const item = queue[i]!
        let result: SyncResult
        try {
            result = await syncNote(app, client, settings, preset, item.file)
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            log(`Sync failed for ${item.file.path}`, 'error', e)
            result = { path: item.file.path, status: 'failed', reason: msg }
        }
        summary[result.status]++
        results.push(result)
        onProgress?.(i + 1, queue.length, result)
    }

    if (preset.listingNoteEnabled && preset.listingNotePath.trim()) {
        try {
            const refreshed = findQueuedNotesForPreset(app, settings, preset.id)
            await regenerateListingNote(app, preset, refreshed, settings.frontmatter)
        } catch (e) {
            log('Listing note regeneration failed', 'error', e)
        }
    }

    return { results, summary }
}
