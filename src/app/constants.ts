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
