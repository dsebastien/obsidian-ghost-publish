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
    │   ├── footnotes.ts                 marked extension: footnote refs/defs/inline → footnote HTML.
    │   ├── build-html.ts                marked (+footnotes) → optional callout + HTML + image cards.
    │   ├── embed-youtube.ts             Post-create upgrade: link paragraphs → embed cards.
    │   ├── embed-links.ts               Post-create upgrade: link paragraphs → bookmark cards.
    │   ├── news-feed-writer.ts          Per-preset listing-note rewriter. Marks
    │   │                                the listing note as ignored after each
    │   │                                regeneration so it never appears as a
    │   │                                triage candidate.
    │   └── ghost-metadata-cache.ts      refreshGhostMetadata: fetch + return tags + newsletters.
    ├── utils/                           Pure helpers (each has a .spec.ts).
    │   ├── strip-sections.fn.ts
    │   ├── process-youtube.fn.ts
    │   ├── process-link-blocks.fn.ts
    │   ├── vault-path-to-url.fn.ts
    │   ├── derive-excerpt.fn.ts
    │   ├── content-hash.fn.ts           Web-Crypto SHA-256.
    │   ├── escape-html.fn.ts
    │   ├── fuzzy-search.fn.ts           Typo-tolerant weighted multi-field fuzzy search
    │   │                                (uses @leeoniya/ufuzzy). Ported from tools-website.
    │   └── promote-images.fn.ts
    └── views/
        ├── view-state.ts                ViewState + SubTab union + DEFAULT_VIEW_STATE.
        │                                Carries searchQuery (panel-local, persists across
        │                                sub-tab switches).
        ├── ghost-publish-view.ts        ItemView. Preset tabs + sub-tabs + search box +
        │                                refresh button + config-warning / no-preset empty
        │                                states. Snapshots scrollTop on `.gp-view-content`
        │                                across each render so manual refresh + sync don't
        │                                snap to the top. The search box lives in the header
        │                                and debounce-re-renders ONLY `.gp-view-content`
        │                                (rerenderContent) so typing never blurs the input.
        └── pages/
            ├── note-search.ts           filterNotesBySearch: wraps fuzzy-search with the
            │                            title+path field config; empty query = no-op.
            ├── triage-page.ts           Per-card publish/email/ignore actions use the
            │                            card-animations helper for in-place removal —
            │                            no full re-render. Filters candidates via note-search.
            ├── queue-page.ts            Same in-place removal for Remove-from-queue;
            │                            Sync button still triggers a full refresh. Search
            │                            filters the visible list; Sync still acts on the
            │                            full queue.
            ├── recently-published-page.ts  Search filters the full published set before the
            │                            30-item cap, so older matches stay findable.
            ├── empty-state-page.ts
            └── card-animations.ts       Fade + height-collapse → DOM remove. Wrapped in
                                         `requestAnimationFrame` + `transitionend` with a
                                         400ms safety fallback for reduced-motion.
```

## Data flow — sync one note under a preset

1. `publish-service.publishAllForPreset(app, settings, preset)` walks `findQueuedNotesForPreset(app, settings, preset.id)`.
2. For each note `sync-note.syncNote(app, client, settings, preset, file)`:
    - reads frontmatter via `metadataCache.getFileCache` using `settings.frontmatter` keys;
    - skips if flag is unset, ignored, or assigned to a different preset id;
    - hashes the body; short-circuits to `unchanged` if id+hash match;
    - if the preset enables canonical URL: HEAD-probes (unless globally skipped);
    - builds the link map via `metadataCache.getFirstLinkpathDest` + frontmatter checks;
    - strips → YouTube → LINK blocks → images → wikilinks → marked (+footnotes) → HTML;
    - calls Ghost (update by id, else create as draft when newsletter+email opt-in, else published);
    - upgrades YouTube/link paragraphs to embed/bookmark cards;
    - transitions draft→published with newsletter slug if shouldEmail;
    - writes ghost_id, synced_at, content_hash, preset id, emailed_at, published, date_published, date_updated.
3. If the preset has `listingNoteEnabled` and a path: `regenerateListingNote(app, preset, refreshedQueue, settings.frontmatter)` — rewrites the listing body via `vault.modify`, then calls `processFrontMatter` to set the configured ignore flag on the listing note itself (the body write wipes any existing frontmatter, so the flag has to be re-established each run).
4. Two-stage refresh of the panel: an immediate `refreshView()` plus a `window.setTimeout(refreshView, POST_SYNC_REFRESH_DELAY_MS)` follow-up so the metadataCache 'changed' events from each `processFrontMatter` write have time to propagate before the queue is re-read.

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
- ItemView with two tab rows: enabled presets (top), sub-tabs Triage / Queue / Recently published (below), then a search box that filters the active sub-tab's list.
- Search is typo-tolerant fuzzy matching over note title + vault path (`note-search.ts` → `fuzzy-search.fn.ts`). The query persists across sub-tab switches and only re-renders `.gp-view-content` (debounced) so the input keeps focus. See BR-UI-8.
- Two empty-state surfaces (no Ghost config, no presets) share the same `renderEmptyState` component with an "Open settings" CTA.
- Settings UI uses Obsidian's `Setting` builder for plain fields, a `Modal` for the preset editor, and `AbstractInputSuggest` for the tag autocomplete.

### Scroll preservation + in-place card removal

Two layers protect the user's scroll position across UI updates:

- **In-place card removal** — per-card destructive actions (publish / publish+email / ignore on triage; remove-from-queue on queue) call `animateCardRemoval(card, onRemoved)` from `pages/card-animations.ts`. The helper locks the card's current height, schedules `.gp-card-removing` on the next animation frame (CSS transition fades opacity → collapses max-height / padding / border), then DOM-removes the element on `transitionend` (with a 400ms safety timeout). No full re-render happens, so other cards' scroll positions don't shift.
- **scrollTop snapshot across full re-renders** — `GhostPublishView.render` calls `snapshotScroll()` before `contentEl.empty()` and `restoreScroll()` once the new content div is in place. This covers the manual refresh button and the queue's Sync button (which still trigger a full re-render because many cards may have changed state).
