/**
 * Minimal shape of a Ghost Admin API post — only the fields the plugin reads or writes.
 * The Admin API returns many more, but we type narrowly to keep noise out.
 */
export interface GhostPost {
    id: string
    title?: string
    slug?: string
    status?: string
    updated_at: string
    canonical_url?: string | null
    custom_excerpt?: string | null
    lexical?: string
}

export interface GhostPostsResponse {
    posts: GhostPost[]
}

export interface GhostImageUploadResponse {
    images: { url: string; ref?: string | null }[]
}

export interface GhostOembedResponse {
    type?: string
    html?: string
    title?: string
    thumbnail_url?: string
    thumbnail_width?: number
    thumbnail_height?: number
    author_name?: string
    author_url?: string
    provider_name?: string
    metadata?: Record<string, unknown>
}

/** Summary of a Ghost tag, as cached for autocomplete in the settings UI. */
export interface GhostTagSummary {
    name: string
    slug: string
    /** Ghost returns 'public' or 'internal'; widened to string for forward compatibility. */
    visibility: string
}

/** Summary of a Ghost newsletter, as cached for the dropdown in the settings UI. */
export interface GhostNewsletterSummary {
    name: string
    slug: string
    status?: string
}

/** Response wrappers from /tags/ and /newsletters/. */
export interface GhostTagsResponse {
    tags: GhostTagSummary[]
    meta?: { pagination?: { next?: number | null; total?: number } }
}

export interface GhostNewslettersResponse {
    newsletters: GhostNewsletterSummary[]
    meta?: { pagination?: { next?: number | null; total?: number } }
}
