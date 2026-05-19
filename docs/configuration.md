---
title: Configuration
nav_order: 3
---

# Configuration

Open **Settings → Ghost Publish**. Settings persist via the standard `loadData` / `saveData` mechanism.

## Ghost

| Setting                 | Type | Default | Description                                                                                      |
| ----------------------- | ---- | ------- | ------------------------------------------------------------------------------------------------ |
| **Ghost URL**           | text | `""`    | Your Ghost site base URL, e.g. `https://example.ghost.io`. No trailing slash.                    |
| **Ghost Admin API key** | text | `""`    | `id:secret` from Ghost Admin → Settings → Integrations. Falls back to `GHOST_ADMIN_KEY` env var. |

## Public mirror (optional)

| Setting            | Type | Default | Description                                                                                               |
| ------------------ | ---- | ------- | --------------------------------------------------------------------------------------------------------- |
| **Notes base URL** | text | `""`    | Public URL of a mirror that exposes your vault. Required for canonical_url presets + wikilink resolution. |

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

| Property     | Default                      | Purpose                                                                  |
| ------------ | ---------------------------- | ------------------------------------------------------------------------ |
| Eligibility  | `""` (optional)              | Property a note must have set to `true` to appear as a triage candidate. |
| Preset id    | `ghost_publish_preset`       | Stores which preset published the note.                                  |
| Flag         | `ghost_publish`              | `true` once in a queue.                                                  |
| Ignore flag  | `ghost_publish_ignore`       | `true` to permanently hide from triage.                                  |
| Email flag   | `ghost_publish_email`        | `true` to opt into the preset's newsletter on first publish.             |
| Synced at    | `ghost_publish_synced_at`    | Timestamp of last sync.                                                  |
| Ghost id     | `ghost_publish_id`           | Ghost post id; enables idempotent updates.                               |
| Content hash | `ghost_publish_content_hash` | SHA-256 of the body; unchanged notes skip the round-trip.                |
| Emailed at   | `ghost_publish_emailed_at`   | Set once on newsletter dispatch; never cleared.                          |
| Excerpt      | `ghost_publish_excerpt`      | Optional. Overrides the auto-derived `custom_excerpt`.                   |

## Tags & newsletters cache

| Setting                        | Type   | Description                                                                                                                                     |
| ------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Refresh tags & newsletters** | button | Fetches every tag and newsletter from Ghost and caches them for autocomplete and dropdowns. Last-fetched timestamps are shown above the button. |

Refreshing is **manual only** — the plugin never auto-fetches.

## Presets

Each preset is edited via a modal:

| Field                 | Description                                                                        |
| --------------------- | ---------------------------------------------------------------------------------- |
| **Name**              | Shown as the panel tab label.                                                      |
| **Enabled**           | Disabled presets don't show as tabs.                                               |
| **Status**            | `published` (default) or `draft`.                                                  |
| **Tags**              | Ordered list. First tag is Ghost's primary tag. Autocomplete from the cached tags. |
| **Newsletter**        | Picked from the dropdown of cached newsletters. Empty disables email opt-in.       |
| **Canonical URL**     | Enable to set `canonical_url` + add a "Canonical version" callout.                 |
| **Listing note**      | Maintain a vault note linking every post currently published under this preset.    |
| **Listing note path** | Vault-relative path. Created with intermediate folders if missing.                 |

Reorder presets in the list using the up / down arrows. The eye icon toggles enabled / disabled without deleting the preset.

## Advanced

| Setting                      | Type   | Default | Description                                             |
| ---------------------------- | ------ | ------- | ------------------------------------------------------- |
| **Skip canonical-URL probe** | toggle | `false` | Push without verifying the canonical URL is live first. |
| **Debug mode**               | toggle | `false` | Verbose logging in the developer console.               |
