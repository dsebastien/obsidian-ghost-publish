---
title: Configuration
nav_order: 3
---

# Configuration

> Requires Obsidian 1.13.0 or later: the settings pane uses the declarative
> settings API, which also makes every setting findable through Obsidian's
> settings search.

Open **Settings → Ghost Publish**. Settings persist via the standard `loadData` / `saveData` mechanism.

## Ghost

| Setting                 | Type   | Default                   | Description                                                                                                                                                                          |
| ----------------------- | ------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Ghost URL**           | text   | `""`                      | Your Ghost site base URL, e.g. `https://example.ghost.io`. No trailing slash.                                                                                                        |
| **Ghost Admin API key** | secret | `ghost-publish-admin-key` | Pick or create the Obsidian secret holding `id:secret` (Ghost Admin → Settings → Integrations). Only the secret's name is saved in the plugin data. Falls back to `GHOST_ADMIN_KEY`. |

### Where the key is stored

The key lives in Obsidian's **secret storage**, which stays on each device and is never synced with your vault. The plugin data file (`data.json`) only keeps the secret's name.

- **Upgrading from 1.1.1 or earlier**: each device copies the old plain-text key into its own secret storage the next time it starts. Nothing to do, every device stays connected.
- The plain-text copy is removed from the plugin data 60 days after the first device migrated it. To remove it sooner, select **Remove plain-text copy now** once all your devices run this version.
- Picking another secret removes the plain-text copy right away. **Forget key** clears the key from this device's secret storage and removes the plain-text copy.
- On a new device (or after the plain-text copy is gone), the settings show a hint until you set the secret on that device once.

## Public mirror (optional)

| Setting            | Type | Default | Description                                                                                                                                        |
| ------------------ | ---- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Notes base URL** | text | `""`    | Public URL of a mirror that exposes your vault. Required for presets that link back to the note or set canonical_url, and for wikilink resolution. |

## Triage

| Setting              | Type     | Default | Description                                                                      |
| -------------------- | -------- | ------- | -------------------------------------------------------------------------------- |
| **Excluded folders** | textarea | `""`    | Path prefixes (one per line) whose notes never appear as triage candidates.      |
| **MoC tag**          | text     | `""`    | Frontmatter / inline tag marking Map-of-Content notes. Empty disables the check. |

## Content processing

| Setting            | Type     | Default | Description                                                                             |
| ------------------ | -------- | ------- | --------------------------------------------------------------------------------------- |
| **Strip sections** | textarea | `""`    | H2 section titles to remove before publishing. Case- and punctuation-insensitive.       |
| **Known URL map**  | textarea | `""`    | Maps wikilink targets to canonical external URLs. Format `NoteName=https://…` per line. |

## Frontmatter properties

Customise the property names the plugin reads / writes. Defaults shown.

| Property     | Default                      | Purpose                                                                        |
| ------------ | ---------------------------- | ------------------------------------------------------------------------------ |
| Eligibility  | `""` (optional)              | Property a note must have set to `true` to appear as a triage candidate.       |
| Preset id    | `ghost_publish_preset`       | Stores which preset published the note.                                        |
| Flag         | `ghost_publish`              | `true` once in a queue.                                                        |
| Ignore flag  | `ghost_publish_ignore`       | `true` to permanently hide from triage.                                        |
| Email flag   | `ghost_publish_email`        | `true` to opt into the preset's newsletter on first publish.                   |
| Synced at    | `ghost_publish_synced_at`    | Timestamp of the last sync that pushed changes.                                |
| Ghost id     | `ghost_publish_id`           | Ghost post id; enables idempotent updates.                                     |
| Content hash | `ghost_publish_content_hash` | SHA-256 of the body; unchanged notes skip the round-trip.                      |
| Emailed at   | `ghost_publish_emailed_at`   | Set once on newsletter dispatch; never cleared.                                |
| Excerpt      | `ghost_publish_excerpt`      | Optional. Overrides the auto-derived `custom_excerpt`.                         |
| Post URL     | `""` (off)                   | Optional. Receives the public address of the post after each create or update. |

**Post URL** is off until you type a property name (for example `ghost_publish_url`). Then, after each sync that creates or updates a post, the plugin writes the address that Ghost gives for the published post into that property. It writes only when the address changed, so a note is not rewritten for nothing. A draft or a scheduled post has no public address yet: the plugin writes nothing for it. A note that did not change is not sent to Ghost, so it gets the property on its next change.

## Tags & newsletters cache

| Setting                        | Type   | Description                                                                                                                                     |
| ------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Refresh tags & newsletters** | button | Fetches every tag and newsletter from Ghost and caches them for autocomplete and dropdowns. Last-fetched timestamps are shown above the button. |

Refreshing is **manual only** — the plugin never auto-fetches.

## Presets

Each preset is edited via a modal:

| Field                                   | Description                                                                                                                         |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Name**                                | Shown as the panel tab label.                                                                                                       |
| **Enabled**                             | Disabled presets don't show as tabs.                                                                                                |
| **Status**                              | `published` (default) or `draft`.                                                                                                   |
| **Tags**                                | Ordered list. First tag is Ghost's primary tag. Autocomplete from the cached tags.                                                  |
| **Newsletter**                          | Picked from the dropdown of cached newsletters. Empty disables email opt-in.                                                        |
| **Link back to the note**               | Start the post with a line that links to the note on your notes site.                                                               |
| **Point the canonical URL to the note** | Set the post's `canonical_url` to the note on your notes site: the note is the original. Turn it off to make the post the original. |
| **Listing note**                        | Maintain a vault note linking every post currently published under this preset.                                                     |
| **Listing note path**                   | Vault-relative path. Created with intermediate folders if missing.                                                                  |

Both link settings need the **Notes base URL** setting. Presets saved by version 1.3.1 or earlier had one **Canonical URL** switch for both: such a preset gets both settings on (or both off), so it works as before.

When **Point the canonical URL to the note** is off and a post still has the `canonical_url` that the plugin set earlier, the next update of the post clears it. A `canonical_url` that you set by hand in Ghost to another address is kept.

Reorder presets in the list using the up / down arrows. The eye icon toggles enabled / disabled without deleting the preset.

## Advanced

| Setting                      | Type   | Default | Description                                                                                                                                       |
| ---------------------------- | ------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Skip canonical-URL probe** | toggle | `false` | Push without checking first that the note is live on your notes site (the check runs when a preset links back to the note or sets canonical_url). |
| **Debug mode**               | toggle | `false` | Verbose logging in the developer console.                                                                                                         |
