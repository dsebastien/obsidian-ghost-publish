/**
 * A reusable publication configuration: which tags to attach, whether to send
 * a newsletter on first publish, whether to link back to the note, and so on.
 *
 * Frontmatter property names are NOT stored per preset — they live in the
 * global PluginSettings.frontmatter object. A note can be published under
 * at most one preset at a time (the preset id is recorded in frontmatter).
 */
export interface Preset {
    /** Stable identifier — generated on creation, never reused or renamed. */
    id: string
    /** Display name shown on the panel tab and settings list. */
    name: string
    /** Whether this preset is currently active (shown as a panel tab). */
    enabled: boolean
    /**
     * Ordered list of tag refs attached to the Ghost post. The first tag is
     * Ghost's primary tag and drives e.g. theme routing.
     */
    tags: PresetTagRef[]
    /**
     * Ghost newsletter slug used when a note opts into email distribution
     * (via the `emailFlag` frontmatter property). Empty disables email entirely.
     */
    newsletterSlug: string
    /**
     * Ghost post status after sync. Default: `published`. `draft` lets you
     * review in Ghost Admin before clicking publish.
     */
    ghostStatus: 'published' | 'draft'
    /**
     * When true, the post body starts with a callout that links back to the
     * note on the public mirror. Requires `notesBaseUrl` to resolve.
     */
    linkBackToNoteEnabled: boolean
    /**
     * When true, the post's `canonical_url` points to the note on the public
     * mirror. Requires `notesBaseUrl` to resolve. Up to 1.3.1 this one flag
     * also drove the link back; `sanitizePreset` migrates saved presets.
     */
    canonicalUrlEnabled: boolean
    /**
     * When true, the plugin maintains a listing note for this preset (one
     * markdown line per published post). Useful as a vault-side index.
     */
    listingNoteEnabled: boolean
    /** Vault-relative path of the listing note. Created if missing. */
    listingNotePath: string
}

export interface PresetTagRef {
    name: string
    visibility: 'public' | 'internal'
}

/** Default fields used when adding a new preset from the settings UI. */
export function newPreset(id: string, name: string): Preset {
    return {
        id,
        name,
        enabled: true,
        tags: [],
        newsletterSlug: '',
        ghostStatus: 'published',
        linkBackToNoteEnabled: false,
        canonicalUrlEnabled: false,
        listingNoteEnabled: false,
        listingNotePath: ''
    }
}

/** A saved preset as read from data.json: only id and name are checked. */
export type SavedPreset = { id: string; name: string } & Record<string, unknown>

/**
 * Rebuild a preset from saved data, with defaults for missing or invalid
 * fields. Migration: a preset saved before `linkBackToNoteEnabled` existed
 * takes it from `canonicalUrlEnabled`, which used to drive both the link
 * back and the field, so an existing preset keeps both on or both off.
 */
export function sanitizePreset(p: SavedPreset): Preset {
    const canonicalUrlEnabled =
        typeof p['canonicalUrlEnabled'] === 'boolean' ? p['canonicalUrlEnabled'] : false
    return {
        id: p.id,
        name: p.name,
        enabled: typeof p['enabled'] === 'boolean' ? p['enabled'] : true,
        tags: Array.isArray(p['tags'])
            ? (p['tags'] as unknown[]).filter(
                  (t): t is PresetTagRef =>
                      typeof t === 'object' &&
                      t !== null &&
                      typeof (t as { name?: unknown }).name === 'string'
              )
            : [],
        newsletterSlug: typeof p['newsletterSlug'] === 'string' ? p['newsletterSlug'] : '',
        ghostStatus: p['ghostStatus'] === 'draft' ? 'draft' : 'published',
        linkBackToNoteEnabled:
            typeof p['linkBackToNoteEnabled'] === 'boolean'
                ? p['linkBackToNoteEnabled']
                : canonicalUrlEnabled,
        canonicalUrlEnabled,
        listingNoteEnabled:
            typeof p['listingNoteEnabled'] === 'boolean' ? p['listingNoteEnabled'] : false,
        listingNotePath: typeof p['listingNotePath'] === 'string' ? p['listingNotePath'] : ''
    }
}
