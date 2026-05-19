import type { Preset } from './preset.intf'
import type { GhostNewsletterSummary, GhostTagSummary } from './ghost-api.intf'

/**
 * Plugin settings, persisted via Obsidian's loadData / saveData.
 *
 * The single source of truth for frontmatter property names is the
 * `frontmatter` map: all presets share the same property names, so a note
 * is published under at most one preset at a time (identified by
 * `frontmatter.preset`).
 */
export interface PluginSettings {
    // ─── Ghost connection ───────────────────────────────────────────────────
    ghostUrl: string
    ghostAdminKey: string

    // ─── Public mirror (for canonical_url presets) ──────────────────────────
    notesBaseUrl: string

    // ─── Content processing (global, shared by all presets) ─────────────────
    stripSections: string[]
    knownUrls: Record<string, string>
    excludedFolders: string[]
    mocTag: string
    skipCanonicalProbe: boolean
    debugModeEnabled: boolean

    // ─── Frontmatter property names (global, shared by all presets) ─────────
    frontmatter: FrontmatterPropertyNames

    // ─── Tag / newsletter caches fetched from Ghost ─────────────────────────
    cachedTags: GhostTagSummary[]
    cachedNewsletters: GhostNewsletterSummary[]
    tagsFetchedAt: number
    newslettersFetchedAt: number

    // ─── Presets ────────────────────────────────────────────────────────────
    presets: Preset[]
}

/**
 * Frontmatter property names the plugin reads / writes. All are configurable
 * so an existing vault with its own naming convention can keep using it.
 *
 * `eligibility` is optional — set to a frontmatter key (e.g. `public_note`)
 * to require it for a note to appear as a triage candidate. Leave empty to
 * make every markdown file eligible.
 */
export interface FrontmatterPropertyNames {
    eligibility: string
    preset: string
    flag: string
    ignoreFlag: string
    emailFlag: string
    syncedAt: string
    ghostId: string
    contentHash: string
    emailedAt: string
    excerpt: string
}

export const DEFAULT_FRONTMATTER: FrontmatterPropertyNames = {
    eligibility: '',
    preset: 'ghost_publish_preset',
    flag: 'ghost_publish',
    ignoreFlag: 'ghost_publish_ignore',
    emailFlag: 'ghost_publish_email',
    syncedAt: 'ghost_publish_synced_at',
    ghostId: 'ghost_publish_id',
    contentHash: 'ghost_publish_content_hash',
    emailedAt: 'ghost_publish_emailed_at',
    excerpt: 'ghost_publish_excerpt'
}

export const DEFAULT_SETTINGS: PluginSettings = {
    ghostUrl: '',
    ghostAdminKey: '',
    notesBaseUrl: '',
    stripSections: [],
    knownUrls: {},
    excludedFolders: [],
    mocTag: '',
    skipCanonicalProbe: false,
    debugModeEnabled: false,
    frontmatter: { ...DEFAULT_FRONTMATTER },
    cachedTags: [],
    cachedNewsletters: [],
    tagsFetchedAt: 0,
    newslettersFetchedAt: 0,
    presets: []
}
