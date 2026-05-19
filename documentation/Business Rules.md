# Business Rules

This document defines the core business rules. These MUST be respected unless explicitly approved otherwise.

---

## Plugin metadata

- **BR-META-1**: `manifest.json.id` is `ghost-publish`. Locked forever once shipped.
- **BR-META-2**: `manifest.json.isDesktopOnly` is `true`. Reason: `process.env.GHOST_ADMIN_KEY` fallback is desktop-only.

## Presets

- **BR-PRESET-1**: A note is assigned to at most ONE preset at a time. The preset id lives in the configurable `frontmatter.preset` field; the queue for a preset selects on this id.
- **BR-PRESET-2**: Preset ids are stable for the lifetime of any note that references them. Renaming a preset (changing `name`) is safe; changing the `id` would orphan all assigned notes. The settings UI never exposes id editing.
- **BR-PRESET-3**: Disabling a preset hides it from the panel but does NOT touch any of its queued notes. Deleting a preset leaves the published Ghost posts intact; orphaned notes stop appearing on the panel.
- **BR-PRESET-4**: Listing notes self-mark as ignored. Every time `regenerateListingNote` rewrites a preset's listing note, it must call `processFrontMatter` to set the configured ignore flag (and clear any stale publish/email/preset flags) on the listing note itself. Reason: the listing note lives in the vault and would otherwise appear as a triage candidate or end up in its own preset's queue. `vault.modify` writes the body and wipes any existing frontmatter, so the flag has to be re-established after every regeneration.

## Auth

- **BR-AUTH-1**: Admin key resolution order is **settings field first, env var (`GHOST_ADMIN_KEY`) second**. Empty/whitespace-only setting falls through to env.
- **BR-AUTH-2**: JWTs are signed via Web Crypto (`crypto.subtle`). Never import Node's `crypto`.

## Network

- **BR-NET-1**: All Ghost HTTP traffic goes through Obsidian's `requestUrl`. Never `fetch`, `node-fetch`, `globalThis.fetch`.
- **BR-NET-2**: Tag / newsletter cache refresh is **manual only**. The plugin does not auto-fetch on startup or panel open.

## Sync semantics

- **BR-SYNC-1**: Idempotency is enforced via SHA-256 of the note body (frontmatter excluded). Matching `frontmatter.contentHash` short-circuits to `unchanged`.
- **BR-SYNC-2**: `frontmatter.ghostId` is the source of truth for "this note has been pushed to Ghost". When set, the sync updates; on 404 it recreates and overwrites the id.
- **BR-SYNC-3**: Newsletter dispatch fires **exactly once per note** — the first sync where the preset has a newsletter AND the email flag is set AND `emailedAt` is unset. `emailedAt` is never cleared by the plugin.
- **BR-SYNC-4**: `date_published` is set once (never overwritten); `date_updated` and `syncedAt` refresh on every successful sync.
- **BR-SYNC-5**: A failed sync of one note must not block subsequent notes. The orchestrator captures the error into a `SyncResult` of status `failed`.
- **BR-SYNC-6**: The canonical-URL probe is opt-in **per preset** (`canonicalUrlEnabled`). When opted in, it can be globally bypassed via the `skipCanonicalProbe` setting.

## Content processing

- **BR-PROC-1**: The first H1 of the body is always stripped (Ghost renders the title from the `title` field, so the H1 would duplicate it).
- **BR-PROC-2**: Strip-sections matching is case- and punctuation-insensitive.
- **BR-PROC-3**: Wikilink resolution priority: LINK-block-paired URL > known URL map > public-mirror URL (only if `frontmatter.eligibility` is set AND `notesBaseUrl` is configured AND the target note satisfies the eligibility key) > bold-text fallback.
- **BR-PROC-4**: `![[image]]` embeds matching `.png/.jpg/.jpeg/.gif/.webp/.svg` are uploaded to Ghost. Non-image `![[…]]` embeds are dropped silently (Ghost has no equivalent).

## UI

- **BR-UI-1**: The panel displays an empty state (not a crash) when Ghost URL / Admin key are missing, OR when no presets are enabled. The empty state always offers an **Open settings** CTA.
- **BR-UI-2**: The panel exposes a top-right **Refresh** button to re-read settings (e.g. after adding a preset).
- **BR-UI-3**: Triage actions and queue mutations always refresh the panel after a write so the user sees the new state.
- **BR-UI-4**: Single-card destructive actions (publish / publish+email / ignore on triage; remove-from-queue on queue) use surgical in-place removal via `animateCardRemoval` — no full re-render. Reason: full re-renders destroy scroll position when many cards are in the list.
- **BR-UI-5**: Full re-renders snapshot `scrollTop` on `.gp-view-content` before `contentEl.empty()` and restore it once the new content is in place. Reason: the manual refresh button and the queue's Sync button still trigger full re-renders; scroll preservation prevents jarring snap-to-top.
- **BR-UI-6**: After a sync completes, the panel refreshes twice — immediately for responsiveness, and again after `POST_SYNC_REFRESH_DELAY_MS` (500 ms). Reason: `app.fileManager.processFrontMatter` resolves before the corresponding `metadataCache` 'changed' events fire, so the immediate refresh would query stale frontmatter and show pre-sync badges + timestamps.

## Defaults

- **BR-DEF-1**: Defaults are author-agnostic. No domain, newsletter slug, vault path, or wikilink target may reference a specific user. Defaults must work for any Ghost install.

## Documentation

- **BR-DOC-1**: When a business rule changes, this file is updated in the same commit. New rules go in concise single-line / brief-paragraph form with rationale.
- **BR-DOC-2**: `documentation/history/yyyy-mm-dd.md` records what was done that day, decisions, open questions. No timing estimates in plans.
