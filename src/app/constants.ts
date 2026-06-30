export const VIEW_TYPE_GHOST_PUBLISH = 'ghost-publish-view'

export const RIBBON_ICON = 'send'
export const VIEW_ICON = 'send'

/** How long Notice popups stay visible by default. */
export const NOTICE_TIMEOUT_MS = 6000

/** Delays (ms) between canonical-URL HEAD probe attempts. */
export const CANONICAL_PROBE_DELAYS_MS = [0, 5000, 15000, 45000]

export const PUBLISH_ICON_OK = '✅'
export const PUBLISH_ICON_FAIL = '❌'

/**
 * `app.fileManager.processFrontMatter` resolves once the file is written,
 * but the metadataCache change events that the panel reads from fire on a
 * subsequent tick. Schedule a follow-up refresh after sync so badges +
 * timestamps reflect the post-sync state instead of the pre-sync one.
 */
export const POST_SYNC_REFRESH_DELAY_MS = 500

/**
 * Debounce (ms) between a keystroke in the panel search box and the content
 * re-render. Keeps typing snappy without re-filtering the card list on every
 * single character.
 */
export const SEARCH_RENDER_DEBOUNCE_MS = 120

/**
 * Cosmetic frontmatter fields written on every successful sync (independent
 * of the configurable per-preset frontmatter).
 */
export const COSMETIC_FM = {
    published: 'published',
    datePublished: 'date_published',
    dateUpdated: 'date_updated',
    created: 'created',
    updated: 'updated'
} as const
