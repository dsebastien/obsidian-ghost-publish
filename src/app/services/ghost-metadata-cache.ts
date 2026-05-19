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
export async function refreshGhostMetadata(settings: PluginSettings): Promise<RefreshResult> {
    const key = resolveAdminKey(settings)
    if (!settings.ghostUrl.trim() || !key) {
        throw new Error('Ghost URL or Admin API key is not configured.')
    }
    const client = new GhostApiClient(settings.ghostUrl.trim(), key)
    const [tags, newsletters] = await Promise.all([
        client.listAllTags(),
        client.listAllNewsletters()
    ])
    return { tags, newsletters, fetchedAt: Date.now() }
}
