# Domain Model

## Entities

### Note (TFile + frontmatter)

A vault markdown file. The plugin reads `cache.frontmatter` and writes via `app.fileManager.processFrontMatter`. All persistent per-note state lives in the note's own frontmatter — the plugin has no separate database.

### Preset

A reusable publication profile. Identified by a stable id (UUID-style); referenced from `frontmatter.preset` on every note it has published.

Fields:

- `id` — stable string id, never reused.
- `name` — display label.
- `enabled` — disabled presets are hidden from the panel but their queued notes remain assigned.
- `tags: PresetTagRef[]` — ordered. The first is Ghost's primary tag.
- `newsletterSlug` — empty disables email opt-in for this preset.
- `ghostStatus` — `published` or `draft`.
- `canonicalUrlEnabled` — sets `canonical_url` + the callout when true.
- `listingNoteEnabled`, `listingNotePath` — optional vault index.

### Candidate

A note eligible for triage (satisfies the optional eligibility gate, not in any preset's queue, not ignored, within the time range, not excluded by folder / MoC / filename).

### Queued note

A note already opted into a specific preset. Tracked by `frontmatter.flag === true` AND `frontmatter.preset === <preset.id>`.

## Frontmatter contract

Property names come from `PluginSettings.frontmatter`. Defaults:

| Logical name | Default key                  | Reader                              | Writer              |
| ------------ | ---------------------------- | ----------------------------------- | ------------------- |
| eligibility  | `""` (optional)              | candidate filter, wikilink resolver | —                   |
| preset       | `ghost_publish_preset`       | queue filter, sync                  | triage picker, sync |
| flag         | `ghost_publish`              | queue filter, sync                  | triage picker       |
| ignoreFlag   | `ghost_publish_ignore`       | candidate filter, sync              | triage picker       |
| emailFlag    | `ghost_publish_email`        | sync                                | triage picker       |
| syncedAt     | `ghost_publish_synced_at`    | recent tab                          | sync                |
| ghostId      | `ghost_publish_id`           | sync, recent tab                    | sync                |
| contentHash  | `ghost_publish_content_hash` | sync                                | sync                |
| emailedAt    | `ghost_publish_emailed_at`   | sync, recent tab                    | sync                |
| excerpt      | `ghost_publish_excerpt`      | sync                                | —                   |

Cosmetic fields (always at default names):

- `title` — read.
- `published`, `date_published`, `date_updated` — written by sync (informational).
- `created`, `updated` — touched by triage actions.

## SyncStatus

```
created | updated | recreated | unchanged | skipped | failed
```

- `created`: new Ghost post (or draft → published email flow).
- `updated`: existing post updated by id.
- `recreated`: id existed but Ghost returned 404 → created fresh.
- `unchanged`: content hash matched; only `synced_at` bumped.
- `skipped`: didn't meet preconditions (flag missing, ignored, wrong preset, canonical probe failed, body empty after stripping).
- `failed`: caught exception bubbled into the SyncResult.

## Triage → Queue → Sync state transitions

```
        ┌─────────────┐    publish / publish+email      ┌──────────────┐
        │  Candidate  │ ───────────────────────────────▶│    Queued    │
        └─────────────┘                                  └──────┬───────┘
              ▲                                                 │
              │ ignore (sets ignoreFlag)                        │ remove (clears flag + preset)
              │                                                 ▼
        ┌─────┴───────┐                                  ┌──────────────┐
        │  Ignored    │                                  │  Unflagged   │ → returns to Candidate next run
        └─────────────┘                                  └──────────────┘
```

Sync only operates on Queued notes. After sync, the note remains Queued — re-runs are cheap thanks to content hashing.
