# Ghost Publish

Publish your vault notes to a [Ghost](https://ghost.org) blog with configurable presets. Each preset captures a publication target — tags, newsletter, canonical-URL strategy, status — and shows up as a tab in the side panel.

## Features

- **Presets** — define one or more publication profiles (Blog post, News, Microblog, …). Each preset has its own tags, optional newsletter slug, and publication status.
- **Side panel** — one tab per preset, with sub-tabs for **Triage** (review candidate notes), **Queue** (notes flagged for sync), and **Recently published**.
- **Triage** — pick notes to publish from a time-range filter, with one-click _publish_, _publish + email_ and _ignore_ actions.
- **Idempotent sync** — each note's body is hashed (SHA-256); unchanged notes skip the round-trip. Ghost post ids are recorded in frontmatter for in-place updates.
- **Auto-fetched tag and newsletter lists** — connect once, click _Refresh tags & newsletters_, and the preset editor offers autocomplete + dropdowns from the cached data.
- **Image upload** — every `![[image]]` embed is uploaded to Ghost and rewritten to a Ghost image card.
- **Wikilink resolution** — known-URL map, optional public-mirror lookup, bold-text fallback.
- **Embed upgrades** — YouTube links become Ghost oembed cards; `LINK:` blocks become bookmark cards.
- **Footnotes** — Markdown footnotes (`text[^1]`, `[^1]: …`, and inline `^[…]`) are rendered to proper footnote anchors and a footnotes section on the published post.
- **Configurable frontmatter keys** — bring your own property names so existing vaults can keep their conventions.
- **Listing notes (optional)** — per preset, maintain a markdown index of every post currently published.

## Install

`isDesktopOnly: true` — the plugin needs network access to Ghost and reads `GHOST_ADMIN_KEY` as an optional env fallback.

Manual install:

1. Build the plugin (`bun install`, then `bun run build`).
2. Copy `dist/main.js`, `dist/manifest.json`, `dist/styles.css` to `<Vault>/.obsidian/plugins/ghost-publish/`.
3. Reload, then enable **Ghost Publish** in **Settings → Community plugins**.

## Quick start

1. Open **Settings → Ghost Publish**: fill in **Ghost URL** and the **Admin API key** (`id:secret` from Ghost Admin → Settings → Integrations).
2. Click **Refresh tags & newsletters** to populate the autocomplete cache.
3. Add a preset (e.g. "Blog post"): pick tags, optionally a newsletter, status, canonical URL strategy.
4. Open the panel (the **send** ribbon icon).
5. On the preset tab → **Triage** sub-tab, pick notes to queue. Switch to **Queue** and click **Sync to Ghost**.

## Privacy & network

This plugin is desktop-only and makes network requests **only to the Ghost site you configure**. It does not collect telemetry, does not call any third-party analytics service, and never reads files outside your vault.

External services used:

- **Ghost Admin API** at your configured Ghost URL — for creating / updating posts, fetching tags & newsletters, uploading embedded images, and triggering optional newsletter dispatches. Authentication uses an Admin API key you provide (either pasted into settings or read from the `GHOST_ADMIN_KEY` environment variable).
- **Public mirror URL** (optional, per preset) — when a preset enables `canonical_url`, the plugin performs a HEAD/GET probe against the canonical URL to verify the public version is reachable before publishing. No vault content is sent in this probe.

The plugin never executes remote code and updates only through normal Obsidian releases.

## Documentation

- [User guide](./docs/) (published via GitHub Pages).
- [Technical documentation](./documentation/) (architecture, business rules, history).
- [Contributing](./CONTRIBUTING.md).

## License

MIT — see [LICENSE](./LICENSE).
