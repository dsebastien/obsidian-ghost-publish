# Configuration

User-facing settings are documented in `docs/configuration.md`. This file covers technical aspects.

## Persistence

- Storage: `app.saveData(this.settings)` (`<vault>/.obsidian/plugins/ghost-publish/data.json`).
- Load: `loadData()` is parsed leniently — every field is type-checked individually; unknown / missing fields fall back to defaults from `DEFAULT_SETTINGS`. Tag / newsletter cache entries are filtered through type guards (`isTagSummary`, `isNewsletterSummary`) and presets through `isPresetLike` + `sanitizePreset`.
- Immutability: settings are wrapped with `immer.produce`. Mutations in the settings tab go through a small `update(mutator)` helper.

## Environment

- `GHOST_ADMIN_KEY`: read as a fallback when the settings field is empty. Trimmed before use.
- `OBSIDIAN_VAULT_LOCATION`: read by the dev build script (`scripts/build.ts`) to auto-copy the dist into the vault. Not read at runtime.

## Settings shape

```typescript
interface PluginSettings {
    // Global Ghost config
    ghostUrl: string
    ghostAdminKey: string

    // Public mirror (optional)
    notesBaseUrl: string

    // Global content processing
    stripSections: string[]
    knownUrls: Record<string, string>
    excludedFolders: string[]
    mocTag: string
    skipCanonicalProbe: boolean
    debugModeEnabled: boolean

    // Configurable frontmatter property names
    frontmatter: FrontmatterPropertyNames

    // Cached Ghost metadata
    cachedTags: GhostTagSummary[]
    cachedNewsletters: GhostNewsletterSummary[]
    tagsFetchedAt: number // unix ms
    newslettersFetchedAt: number

    // Presets (one tab per enabled preset)
    presets: Preset[]
}

interface Preset {
    id: string
    name: string
    enabled: boolean
    tags: { name: string; visibility: 'public' | 'internal' }[] // ordered
    newsletterSlug: string
    ghostStatus: 'published' | 'draft'
    canonicalUrlEnabled: boolean
    listingNoteEnabled: boolean
    listingNotePath: string
}

interface FrontmatterPropertyNames {
    eligibility: string // '' disables the gate
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
```

## Defaults rationale

- `presets: []` — explicit empty list. The panel shows an empty state until the user creates a preset.
- `stripSections: []`, `knownUrls: {}`, `excludedFolders: []`, `mocTag: ''` — author-agnostic, opt-in only.
- `frontmatter` — neutral `ghost_publish_*` prefix. Configurable to match any existing vault convention.
- `eligibility: ''` — empty so every markdown file qualifies until the user opts in to a gate.
- `skipCanonicalProbe: false` — safer default.
- `debugModeEnabled: false` — keeps the developer console quiet.
