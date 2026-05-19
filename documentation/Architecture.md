# Architecture

## Layers

```
src/
├── main.ts                              Entry point. Exports the plugin class.
├── styles.src.css                       Tailwind source. Compiled to styles.css.
├── utils/log.ts                         Centralized log shim (console.* suppressed for catalog).
└── app/
    ├── plugin.ts                        Lifecycle: onload, settings I/O, commands, view activation,
    │                                    per-preset publish orchestration.
    ├── constants.ts                     View type id, icons, timeouts, cosmetic FM keys.
    ├── types/
    │   ├── plugin-settings.intf.ts      PluginSettings + DEFAULT_FRONTMATTER property names.
    │   ├── preset.intf.ts               Preset + PresetTagRef + newPreset factory.
    │   ├── sync-result.intf.ts          SyncStatus + SyncResult + SyncSummary.
    │   ├── ghost-api.intf.ts            Narrow shapes of Ghost Admin responses.
    │   └── news-candidate.intf.ts       PublicationCandidate, QueuedNote, TriageRange.
    ├── settings/
    │   ├── settings-tab.ts              Top-level settings UI (sections + presets list).
    │   ├── preset-editor-modal.ts       Modal for creating / editing a preset.
    │   ├── tag-suggest.ts               AbstractInputSuggest backed by cachedTags.
    │   └── confirm-modal.ts             Generic confirm Modal (replaces window.confirm).
    ├── api/
    │   ├── ghost-auth.ts                JWT signing via Web Crypto (HMAC-SHA256). No node crypto.
    │   └── ghost-api-client.ts          requestUrl-based client. Posts + images + oembed
    │                                    + listAllTags + listAllNewsletters.
    ├── services/
    │   ├── publish-service.ts           publishAllForPreset orchestrator.
    │   ├── sync-note.ts                 Single-note sync pipeline (preset-aware).
    │   ├── candidate-discovery.ts       Find triage candidates / queued notes per preset.
    │   ├── triage-actions.ts            Frontmatter mutations (uses configurable FM keys).
    │   ├── canonical-probe.ts           GET probe with exponential backoff.
    │   ├── wikilink-resolver.ts         metadataCache-based wikilink → URL map.
    │   ├── upload-vault-images.ts       Push ![[image]] embeds to Ghost.
    │   ├── build-html.ts                marked → optional callout + HTML + image cards.
    │   ├── embed-youtube.ts             Post-create upgrade: link paragraphs → embed cards.
    │   ├── embed-links.ts               Post-create upgrade: link paragraphs → bookmark cards.
    │   ├── news-feed-writer.ts          Per-preset listing-note rewriter.
    │   └── ghost-metadata-cache.ts      refreshGhostMetadata: fetch + return tags + newsletters.
    ├── utils/                           Pure helpers (each has a .spec.ts).
    │   ├── strip-sections.fn.ts
    │   ├── process-youtube.fn.ts
    │   ├── process-link-blocks.fn.ts
    │   ├── vault-path-to-url.fn.ts
    │   ├── derive-excerpt.fn.ts
    │   ├── content-hash.fn.ts           Web-Crypto SHA-256.
    │   ├── escape-html.fn.ts
    │   └── promote-images.fn.ts
    └── views/
        ├── view-state.ts                ViewState + SubTab union + DEFAULT_VIEW_STATE.
        ├── ghost-publish-view.ts        ItemView. Preset tabs + sub-tabs + refresh button +
        │                                config-warning / no-preset empty states.
        └── pages/
            ├── triage-page.ts
            ├── queue-page.ts
            ├── recently-published-page.ts
            └── empty-state-page.ts
```

## Data flow — sync one note under a preset

1. `publish-service.publishAllForPreset(app, settings, preset)` walks `findQueuedNotesForPreset(app, settings, preset.id)`.
2. For each note `sync-note.syncNote(app, client, settings, preset, file)`:
    - reads frontmatter via `metadataCache.getFileCache` using `settings.frontmatter` keys;
    - skips if flag is unset, ignored, or assigned to a different preset id;
    - hashes the body; short-circuits to `unchanged` if id+hash match;
    - if the preset enables canonical URL: HEAD-probes (unless globally skipped);
    - builds the link map via `metadataCache.getFirstLinkpathDest` + frontmatter checks;
    - strips → YouTube → LINK blocks → images → wikilinks → marked → HTML;
    - calls Ghost (update by id, else create as draft when newsletter+email opt-in, else published);
    - upgrades YouTube/link paragraphs to embed/bookmark cards;
    - transitions draft→published with newsletter slug if shouldEmail;
    - writes ghost_id, synced_at, content_hash, preset id, emailed_at, published, date_published, date_updated.
3. If the preset has `listingNoteEnabled` and a path: `regenerateListingNote(app, preset, refreshedQueue)`.

## Settings: presets vs. globals

Globals (shared by all presets):

- Ghost connection (URL, admin key).
- Notes base URL (for canonical URLs + wikilink resolution).
- Triage filters (excluded folders, MoC tag).
- Content processing (strip sections, known URL map).
- Frontmatter property names — single global set, since a note is in at most one preset's queue at a time.
- Cached Ghost tags / newsletters + timestamps.

Per preset:

- Name, enabled, status (published/draft).
- Tags (ordered) + visibility per tag.
- Newsletter slug.
- Canonical URL toggle.
- Listing note enabled + path.

## Tag / newsletter cache

`services/ghost-metadata-cache.ts.refreshGhostMetadata` fetches via the API client's `listAllTags()` / `listAllNewsletters()` (both paginate the Admin API). The result + a timestamp is persisted into PluginSettings. The settings UI surfaces last-fetched timestamps and a manual **Refresh** button. The plugin never auto-fetches.

## Auth

- JWT signing uses Web Crypto (`crypto.subtle.importKey('raw', …)` + `crypto.subtle.sign('HMAC', …)`).
- Admin key resolves from `settings.ghostAdminKey` first, then `process.env.GHOST_ADMIN_KEY`.
- `isDesktopOnly: true` because the env fallback uses `process.env`.

## Network

- All Ghost calls go through Obsidian's `requestUrl`.
- JSON bodies use `contentType: 'application/json'`; image upload builds a multipart body manually and passes an ArrayBuffer.
- HTTP errors throw `GhostApiError(detail, statusCode)`; `sync-note` distinguishes 404 from other errors to trigger a recreate.

## UI

- View type: `ghost-publish-view`.
- ItemView with two tab rows: enabled presets (top), sub-tabs Triage / Queue / Recently published (below).
- Two empty-state surfaces (no Ghost config, no presets) share the same `renderEmptyState` component with an "Open settings" CTA.
- Settings UI uses Obsidian's `Setting` builder for plain fields, a `Modal` for the preset editor, and `AbstractInputSuggest` for the tag autocomplete.
