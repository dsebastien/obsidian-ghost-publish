import type { App } from 'obsidian'
import { GhostApiClient } from '../api/ghost-api-client'
import type { PluginSettings } from '../types/plugin-settings.intf'
import type { GhostNewsletterSummary, GhostTagSummary } from '../types/ghost-api.intf'
import { resolveAdminKey } from './publish-service'

export interface RefreshResult {
    tags: GhostTagSummary[]
    newsletters: GhostNewsletterSummary[]
    fetchedAt: number
}

/**
 * Fetch the latest tags and newsletters from Ghost. The caller is expected
 * to persist the result into PluginSettings.
 */
export async function refreshGhostMetadata(
    app: App,
    settings: PluginSettings
): Promise<RefreshResult> {
    const key = resolveAdminKey(app, settings)
    if (!settings.ghostUrl.trim() || !key) {
        throw new Error(
            'Ghost URL or Admin API key is not configured. The key lives in secret storage, which is per device: set it on this device in the plugin settings.'
        )
    }
    const client = new GhostApiClient(settings.ghostUrl.trim(), key)
    const [tags, newsletters] = await Promise.all([
        client.listAllTags(),
        client.listAllNewsletters()
    ])
    return { tags, newsletters, fetchedAt: Date.now() }
}
