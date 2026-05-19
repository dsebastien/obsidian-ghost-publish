/**
 * A reusable publication configuration: which tags to attach, whether to send
 * a newsletter on first publish, whether to set canonical_url, and so on.
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
     * When true, the published post carries `canonical_url` and a callout
     * linking back to the public mirror. Requires `notesBaseUrl` to resolve.
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
        canonicalUrlEnabled: false,
        listingNoteEnabled: false,
        listingNotePath: ''
    }
}
