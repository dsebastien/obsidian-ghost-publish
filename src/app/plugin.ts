import { Notice, Plugin } from 'obsidian'
import { produce } from 'immer'
import type { Draft } from 'immer'
import { DEFAULT_FRONTMATTER, DEFAULT_SETTINGS } from './types/plugin-settings.intf'
import type { FrontmatterPropertyNames, PluginSettings } from './types/plugin-settings.intf'
import type { Preset } from './types/preset.intf'
import type { GhostNewsletterSummary, GhostTagSummary } from './types/ghost-api.intf'
import { GhostPublishSettingTab } from './settings/settings-tab'
import {
    NOTICE_TIMEOUT_MS,
    POST_SYNC_REFRESH_DELAY_MS,
    PUBLISH_ICON_FAIL,
    PUBLISH_ICON_OK,
    RIBBON_ICON,
    VIEW_TYPE_GHOST_PUBLISH
} from './constants'
import { GhostPublishView } from './views/ghost-publish-view'
import { MissingGhostConfigError, publishAllForPreset } from './services/publish-service'
import { log } from '../utils/log'

export class GhostPublishPlugin extends Plugin {
    override settings: PluginSettings = produce(DEFAULT_SETTINGS, () => DEFAULT_SETTINGS)

    override async onload(): Promise<void> {
        log('Initializing', 'debug')
        await this.loadSettings()

        this.registerView(VIEW_TYPE_GHOST_PUBLISH, (leaf) => new GhostPublishView(leaf, this))

        this.addSettingTab(new GhostPublishSettingTab(this.app, this))

        this.addRibbonIcon(RIBBON_ICON, 'Open Ghost Publish', () => {
            void this.activateView()
        })

        this.addCommand({
            id: 'open-panel',
            name: 'Open panel',
            callback: () => {
                void this.activateView()
            }
        })

        this.addCommand({
            id: 'sync-all-presets',
            name: 'Sync queued notes for all enabled presets',
            callback: () => {
                void this.runPublishAllPresets()
            }
        })
    }

    override onunload(): void {}

    async activateView(): Promise<void> {
        const { workspace } = this.app
        let leaf = workspace.getLeavesOfType(VIEW_TYPE_GHOST_PUBLISH)[0] ?? null
        if (!leaf) {
            const rightLeaf = workspace.getRightLeaf(false)
            if (rightLeaf) {
                await rightLeaf.setViewState({
                    type: VIEW_TYPE_GHOST_PUBLISH,
                    active: true
                })
                leaf = rightLeaf
            }
        }
        if (leaf) {
            await workspace.revealLeaf(leaf)
        }
    }

    /**
     * Opens the plugin's own page in the global Settings dialog. Used by
     * the panel's empty-state "Open settings" CTA.
     */
    async openSettingsTab(): Promise<void> {
        const settingApi = (
            this.app as unknown as {
                setting?: { open: () => void; openTabById: (id: string) => void }
            }
        ).setting
        if (!settingApi) return
        settingApi.open()
        settingApi.openTabById(this.manifest.id)
    }

    async runPublishAllForPreset(presetId: string): Promise<void> {
        const preset = this.settings.presets.find((p) => p.id === presetId)
        if (!preset) {
            new Notice(`Preset not found: ${presetId}`, NOTICE_TIMEOUT_MS)
            return
        }
        try {
            new Notice(`Syncing "${preset.name}"…`, NOTICE_TIMEOUT_MS)
            const { summary, results } = await publishAllForPreset(this.app, this.settings, preset)
            const parts = Object.entries(summary)
                .filter(([, n]) => n > 0)
                .map(([k, n]) => `${n} ${k}`)
            const headline =
                summary.failed > 0
                    ? `${PUBLISH_ICON_FAIL} ${preset.name}: errors`
                    : `${PUBLISH_ICON_OK} ${preset.name}: done`
            const body = parts.length > 0 ? parts.join(', ') : 'nothing to do'
            new Notice(`${headline} — ${body}`, NOTICE_TIMEOUT_MS)
            // Two-stage refresh:
            //   1) Immediate, so the panel feels responsive (Notice + reset).
            //   2) Delayed, so metadataCache 'changed' events from each
            //      processFrontMatter write have time to propagate. Without
            //      this second pass, queue badges + sync timestamps reflect
            //      the pre-sync state.
            this.refreshView()
            window.setTimeout(() => this.refreshView(), POST_SYNC_REFRESH_DELAY_MS)
            for (const r of results) {
                if (r.status === 'failed') {
                    log(`Failed: ${r.path}`, 'error', r.reason)
                }
            }
        } catch (e) {
            if (e instanceof MissingGhostConfigError) {
                new Notice(e.message, NOTICE_TIMEOUT_MS)
                return
            }
            const msg = e instanceof Error ? e.message : String(e)
            log('publishAllForPreset threw', 'error', e)
            new Notice(`${PUBLISH_ICON_FAIL} ${preset.name}: ${msg}`, NOTICE_TIMEOUT_MS)
        }
    }

    async runPublishAllPresets(): Promise<void> {
        const enabled = this.settings.presets.filter((p) => p.enabled)
        if (enabled.length === 0) {
            new Notice('No enabled presets — nothing to sync.', NOTICE_TIMEOUT_MS)
            return
        }
        for (const preset of enabled) {
            await this.runPublishAllForPreset(preset.id)
        }
    }

    refreshView(): void {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_GHOST_PUBLISH)
        for (const leaf of leaves) {
            const view = leaf.view as GhostPublishView
            view.refresh()
        }
    }

    async loadSettings(): Promise<void> {
        log('Loading settings', 'debug')
        const loaded = (await this.loadData()) as Partial<PluginSettings> | null

        if (!loaded) {
            this.settings = produce(DEFAULT_SETTINGS, () => DEFAULT_SETTINGS)
            return
        }

        this.settings = produce(this.settings, (draft: Draft<PluginSettings>) => {
            if (typeof loaded.ghostUrl === 'string') draft.ghostUrl = loaded.ghostUrl
            if (typeof loaded.ghostAdminKey === 'string') draft.ghostAdminKey = loaded.ghostAdminKey
            if (typeof loaded.notesBaseUrl === 'string') draft.notesBaseUrl = loaded.notesBaseUrl

            if (Array.isArray(loaded.stripSections)) {
                draft.stripSections = loaded.stripSections.filter(
                    (s): s is string => typeof s === 'string'
                )
            }
            if (loaded.knownUrls && typeof loaded.knownUrls === 'object') {
                const sanitized: Record<string, string> = {}
                for (const [k, v] of Object.entries(loaded.knownUrls)) {
                    if (typeof v === 'string' && k.trim().length > 0) {
                        sanitized[k] = v
                    }
                }
                draft.knownUrls = sanitized
            }
            if (Array.isArray(loaded.excludedFolders)) {
                draft.excludedFolders = loaded.excludedFolders.filter(
                    (s): s is string => typeof s === 'string'
                )
            }
            if (typeof loaded.mocTag === 'string') draft.mocTag = loaded.mocTag
            if (typeof loaded.skipCanonicalProbe === 'boolean')
                draft.skipCanonicalProbe = loaded.skipCanonicalProbe
            if (typeof loaded.debugModeEnabled === 'boolean')
                draft.debugModeEnabled = loaded.debugModeEnabled

            draft.frontmatter = mergeFrontmatter(loaded.frontmatter)

            if (Array.isArray(loaded.cachedTags)) {
                draft.cachedTags = loaded.cachedTags.filter(isTagSummary)
            }
            if (Array.isArray(loaded.cachedNewsletters)) {
                draft.cachedNewsletters = loaded.cachedNewsletters.filter(isNewsletterSummary)
            }
            if (typeof loaded.tagsFetchedAt === 'number') draft.tagsFetchedAt = loaded.tagsFetchedAt
            if (typeof loaded.newslettersFetchedAt === 'number')
                draft.newslettersFetchedAt = loaded.newslettersFetchedAt

            if (Array.isArray(loaded.presets)) {
                draft.presets = loaded.presets.filter(isPresetLike).map((p) => sanitizePreset(p))
            }
        })
    }

    async saveSettings(): Promise<void> {
        log('Saving settings', 'debug')
        await this.saveData(this.settings)
    }
}

function isTagSummary(t: unknown): t is GhostTagSummary {
    return (
        typeof t === 'object' &&
        t !== null &&
        typeof (t as { name?: unknown }).name === 'string' &&
        typeof (t as { slug?: unknown }).slug === 'string'
    )
}

function isNewsletterSummary(n: unknown): n is GhostNewsletterSummary {
    return (
        typeof n === 'object' &&
        n !== null &&
        typeof (n as { name?: unknown }).name === 'string' &&
        typeof (n as { slug?: unknown }).slug === 'string'
    )
}

function isPresetLike(p: unknown): p is Preset {
    return (
        typeof p === 'object' &&
        p !== null &&
        typeof (p as { id?: unknown }).id === 'string' &&
        typeof (p as { name?: unknown }).name === 'string'
    )
}

function mergeFrontmatter(
    loaded: Partial<FrontmatterPropertyNames> | undefined
): FrontmatterPropertyNames {
    if (!loaded || typeof loaded !== 'object') return { ...DEFAULT_FRONTMATTER }
    const out: FrontmatterPropertyNames = { ...DEFAULT_FRONTMATTER }
    for (const key of Object.keys(DEFAULT_FRONTMATTER) as (keyof FrontmatterPropertyNames)[]) {
        const v = loaded[key]
        if (typeof v === 'string') out[key] = v
    }
    return out
}

function sanitizePreset(p: Preset): Preset {
    return {
        id: p.id,
        name: p.name,
        enabled: typeof p.enabled === 'boolean' ? p.enabled : true,
        tags: Array.isArray(p.tags)
            ? p.tags.filter(
                  (t) => typeof t === 'object' && t !== null && typeof t.name === 'string'
              )
            : [],
        newsletterSlug: typeof p.newsletterSlug === 'string' ? p.newsletterSlug : '',
        ghostStatus: p.ghostStatus === 'draft' ? 'draft' : 'published',
        canonicalUrlEnabled:
            typeof p.canonicalUrlEnabled === 'boolean' ? p.canonicalUrlEnabled : false,
        listingNoteEnabled:
            typeof p.listingNoteEnabled === 'boolean' ? p.listingNoteEnabled : false,
        listingNotePath: typeof p.listingNotePath === 'string' ? p.listingNotePath : ''
    }
}
