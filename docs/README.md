---
title: Overview
nav_order: 1
permalink: /
---

# Ghost Publish

Publish your vault notes to a Ghost blog. Define one or more **presets** (e.g. "Blog post", "News", "Microblog"), each with its own tags, optional newsletter and publishing options. The plugin side panel surfaces one tab per preset.

## Key features

- **Presets** capture a publication target. Add as many as you need; each becomes a panel tab.
- **Triage** — review candidate notes filtered by a time range, decide one note at a time.
- **One-click sync** — push every queued note for the active preset; unchanged notes skip the round-trip via content hashing.
- **Idempotent updates** — recorded Ghost post id enables in-place updates; 404 triggers a clean recreate.
- **Optional newsletter dispatch** — opt a note into the configured newsletter for first publish.
- **Embed upgrades** — YouTube links → oembed cards; `LINK:` blocks → bookmark cards.
- **Wikilink resolution** — known-URL map, optional public-mirror lookup.
- **Configurable frontmatter keys** — keep your existing conventions.

## Quick start

1. Install and enable the plugin.
2. **Settings → Ghost Publish**: fill in Ghost URL + Admin API key, then **Refresh tags & newsletters**.
3. Click **Add preset**, give it a name, pick tags / newsletter, save.
4. Open the panel from the ribbon (paper-plane icon).
5. Triage → Queue → Sync.

## About

Created by [Sébastien Dubois](https://dsebastien.net).
