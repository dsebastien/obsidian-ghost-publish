---
title: Usage
nav_order: 2
---

# Usage

## Opening the panel

Three ways:

- Click the **paper-plane** ribbon icon.
- Run **Ghost Publish: Open panel** from the command palette.
- Run **Ghost Publish: Sync queued notes for all enabled presets** to bulk-sync without opening the panel.

The panel lives in the right sidebar by default. The top row of tabs lists every enabled preset. Below it, sub-tabs (Triage / Queue / Recently published) apply to the active preset.

## Empty state

If you haven't configured Ghost yet, or if you have no enabled presets, the panel shows an empty state with an **Open settings** button.

The panel also has a **Refresh** button (top right) — use it after changing settings to repopulate the tab list.

## Presets

A preset is a reusable publication profile:

- **Name** — shown as the panel tab label.
- **Enabled** — disabled presets don't show as tabs.
- **Status** — `published` (default) or `draft`. Drafts give you a chance to review in Ghost Admin before clicking publish.
- **Tags** — an ordered list. The first tag is Ghost's primary tag and drives theme routing for sites with custom routes.
- **Newsletter** — pick from the dropdown (populated from the cached Ghost newsletters). Leave empty to disable email opt-in.
- **Set canonical_url** — when on, the post receives `canonical_url` pointing at the public-mirror URL of the note, plus a small "Canonical version" callout. Requires the global **Notes base URL** setting.
- **Listing note** — when on, the plugin maintains a markdown file in your vault listing every note currently published under this preset.

Presets are reorderable; reorder them in settings to control the panel tab order.

## Opening notes from the panel

Every note title across the three sub-tabs (Triage / Queue / Recently published) behaves like a standard Obsidian wikilink:

- **Click** — opens the note in the current tab.
- **Ctrl/Cmd + click** — opens the note in a new tab.
- **Middle click** — opens the note in a new tab.

## Triage

The Triage sub-tab lists notes that:

- satisfy the optional **eligibility** frontmatter gate (configured globally);
- are not already in any preset's queue;
- are not flagged as ignored;
- fall within the selected time range (Today / This week / Last 14 days / This month / This year / All time);
- are not under an excluded folder, not a MoC note, and don't end in `(MoC)`.

For each candidate, three actions:

| Action              | Effect (on frontmatter)                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| **Publish**         | Sets the flag + the preset id; clears ignore.                                                    |
| **Publish + email** | Same as Publish, also sets the email flag. Only shown if the preset has a newsletter configured. |
| **Ignore**          | Sets the ignore flag; clears flag + preset id.                                                   |

## Queue

The Queue sub-tab lists every note already flagged for the active preset. Each card shows a **Synced** / **New** badge and an optional **Newsletter** badge. **Sync to Ghost** at the top runs the full pipeline for every note in this preset's queue.

By default, notes that already have a Ghost id (the **Synced** badge) are **hidden** so the queue reads as a punch-list of what's left to push. Toggle **Show synced notes** in the filter bar to reveal them. The toggle only affects what's rendered — **Sync to Ghost** always operates on every queued note, regardless of the filter.

You can remove a note from the queue without affecting the post on Ghost (the post stays live; the plugin just stops tracking it).

Sync completion takes about half a second to reflect in the queue (badges flip from **New** to **Synced**, timestamps update). The slight delay is intentional — it lets Obsidian's metadata cache catch up to the frontmatter writes the sync just made.

## Recently published

Up to 30 notes with a Ghost id and a sync timestamp for the active preset, sorted by most recent. The **Open in Ghost** button opens the Ghost Admin editor for that post.

## What gets sent to Ghost for each note

1. **Hash check.** SHA-256 of the body — match against the recorded hash → `unchanged`, just bump the synced-at timestamp.
2. **Canonical probe** (when the preset enables `canonical_url`) — GET against the resolved canonical URL with exponential backoff. Skippable globally.
3. **Body transforms:**
    - Strip Dataview / Dataview Serializer blocks.
    - Strip H2 sections matching the configured strip list (case- and punctuation-insensitive).
    - Strip the very first H1 (Ghost adds the title automatically).
    - Rewrite `![](youtube-url)` and `LINK:` blocks to marker paragraphs.
    - Upload every `![[image]]` to Ghost; rewrite to `![alt](ghost-url)`.
    - Resolve `[[wikilinks]]`: LINK-block URL > known URL map > public-mirror URL (when eligibility key is set) > bold-text fallback.
4. **HTML build.** Markdown → HTML via `marked`; canonical callout prepended when applicable.
5. **Post create or update.** Status, tags, optional `canonical_url`, `custom_excerpt`. Existing posts use `updated_at` for optimistic concurrency. 404 triggers a clean recreate.
6. **Embed upgrades.** YouTube paragraphs → oembed cards; LINK-block paragraphs → bookmark cards.
7. **Optional newsletter dispatch.** If the preset has a newsletter AND the note opted into email AND it has never been emailed, the draft transitions to published with the newsletter slug (the only Ghost transition that fires the email).
8. **Frontmatter writeback.** ghost_id, synced_at, content_hash, preset id, optionally emailed_at, plus the cosmetic `published`, `date_published`, `date_updated` fields.

## Listing notes

When a preset has **Listing note** enabled, the plugin regenerates the configured note after every sync with one markdown line per published post (most recent first). The plugin automatically marks the listing note with the configured ignore flag so it never appears as a triage candidate — even though it lives in your vault and may otherwise match your eligibility gate. If you delete or rename the listing path in settings, the previously-generated note is left in place (the plugin doesn't garbage-collect old listing notes).

## Commands

| Command                                                  | Description                        |
| -------------------------------------------------------- | ---------------------------------- |
| Ghost Publish: Open panel                                | Open or focus the panel.           |
| Ghost Publish: Sync queued notes for all enabled presets | Run sync for every enabled preset. |
