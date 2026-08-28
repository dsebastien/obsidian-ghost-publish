# Ghost Publish

Publish your vault notes to a [Ghost](https://ghost.org) blog with configurable presets. Each preset captures a publication target — tags, newsletter, canonical-URL strategy, status — and shows up as a tab in the side panel.

## Features

- **Presets** — define one or more publication profiles (Blog post, News, Microblog, …). Each preset has its own tags, optional newsletter slug, and publication status.
- **Side panel** — one tab per preset, with sub-tabs for **Triage** (review candidate notes), **Queue** (notes flagged for sync), and **Recently published**.
- **Search** — a search box at the top of the panel fuzzy-filters the active sub-tab's list by note title and path (typo-tolerant, e.g. `obsk` → _Obsidian Starter Kit_). The query carries over when you switch sub-tabs.
- **Triage** — pick notes to publish from a time-range filter, with one-click _publish_, _publish + email_ and _ignore_ actions.
- **Idempotent sync** — each note's body is hashed (SHA-256); unchanged notes skip the round-trip. Ghost post ids are recorded in frontmatter for in-place updates.
- **Auto-fetched tag and newsletter lists** — connect once, click _Refresh tags & newsletters_, and the preset editor offers autocomplete + dropdowns from the cached data.
- **Image upload** — every `![[image]]` embed is uploaded to Ghost and rewritten to a Ghost image card.
- **Wikilink resolution** — known-URL map, optional public-mirror lookup, bold-text fallback.
- **Embed upgrades** — YouTube links become Ghost oembed cards; `LINK:` blocks become bookmark cards.
- **Footnotes** — Markdown footnotes (`text[^1]`, `[^1]: …`, and inline `^[…]`) are rendered to proper footnote anchors and a footnotes section on the published post.
- **Configurable frontmatter keys** — bring your own property names so existing vaults can keep their conventions.
- **Listing notes (optional)** — per preset, maintain a markdown index of every post currently published.
- **What's new after updates.** After a plugin update, a one-time dialog shows the release notes you just received (including skipped versions) with ways to support development. Never shown on fresh installs or regular restarts.

## Install

> **Requires Obsidian 1.13.0 or later.** The settings pane uses the declarative
> settings API introduced in 1.13. On an older version the plugin will not load,
> and the community catalog will not offer it to you — but a manual or BRAT
> install can still put an incompatible build in your vault, so check
> **Settings → About** first.

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

<!-- other-plugins:start -->

## My other Obsidian plugins

| Plugin                                                                                                        | What it does                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| [Agentic Resource Discovery Server](https://github.com/dsebastien/obsidian-agentic-resource-discovery-server) | Local-first Agentic Resource Discovery publisher and registry that serves your AI skills and tools to agents over a local HTTP and MCP server |
| [Book Exporter](https://github.com/dsebastien/obsidian-book-exporter)                                         | Export books (one manifest note + linked chapter notes) to EPUB and PDF via Pandoc                                                            |
| [Bookshelf Base](https://github.com/dsebastien/obsidian-bookshelf)                                            | Display your notes as a visual bookshelf via a custom Bases view                                                                              |
| [Dataview Serializer](https://github.com/dsebastien/obsidian-dataview-serializer)                             | Serialize Dataview queries to Markdown, and keep the Markdown representation up to date                                                       |
| [Expander](https://github.com/dsebastien/obsidian-expander)                                                   | Replace variables across your vault using HTML comment markers. Supports static values and dynamic functions                                  |
| [Graph Explorer Base View](https://github.com/dsebastien/obsidian-graph-explorer-base-view)                   | A custom Bases view that renders notes as an interactive force-directed graph with explored/unexplored tracking                               |
| [Hidden Folders Access](https://github.com/dsebastien/obsidian-hidden-folders-access)                         | Index hidden root-level folders (e.g. .claude) so they appear in the file tree, metadata cache, and Bases                                     |
| [Journal Bases](https://github.com/dsebastien/obsidian-journal-base)                                          | Custom Base views for journaling and periodic reviews                                                                                         |
| [Kanban Action Planner](https://github.com/dsebastien/obsidian-kanban-action-planner)                         | Render your notes as configurable Kanban boards and calendars inside Bases, with statuses, ordering, relationships, and scheduling            |
| [Life Tracker](https://github.com/dsebastien/obsidian-life-tracker-base-view)                                 | Capture and visualize the data that matters in your life                                                                                      |
| [Note Village](https://github.com/dsebastien/obsidian-note-village)                                           | A 2D pixel art village where your notes become villagers you can explore and chat with using AI                                               |
| [Obsidian Starter Kit](https://github.com/DeveloPassion/obsidian-starter-kit-plugin)                          | Adds strong typing support and powerful automation support for notes                                                                          |
| [Remarkable Synchronizer](https://github.com/dsebastien/obsidian-remarkable-sync)                             | Connect to the reMarkable cloud, list, download, and sync notebook pages as images                                                            |
| [Replicate](https://github.com/dsebastien/obsidian-replicate)                                                 | Use AI models with ease via the Replicate.com integration                                                                                     |
| [REST and MCP server](https://github.com/dsebastien/obsidian-cli-rest)                                        | Exposes CLI commands as RESTful API endpoints and an MCP server for AI tool integration                                                       |
| [Time Machine](https://github.com/dsebastien/obsidian-time-machine)                                           | Browse, compare, and restore previous versions of your notes using built-in file-recovery snapshots                                           |
| [Transcriber](https://github.com/dsebastien/obsidian-transcriber)                                             | Transcribe images to markdown using Ollama vision models                                                                                      |
| [Typefully](https://github.com/dsebastien/obsidian-typefully)                                                 | Publish social media posts with ease using the Typefully integration                                                                          |
| [Update Time](https://github.com/dsebastien/obsidian-update-time)                                             | Automatically update front matter to include creation and last update times                                                                   |

Everything I build is documented in [my newsletter](https://dsebastien.net/newsletter) and on [my YouTube channel](https://youtube.com/@dsebastien).

<!-- other-plugins:end -->

<!-- support-cta -->

## News & support

To stay up to date about this plugin, Obsidian in general, Personal Knowledge Management and note-taking:

- Subscribe to [my newsletter](https://dsebastien.net/newsletter)
- Subscribe to [my YouTube channel](https://youtube.com/@dsebastien)
- Join the [Knowii community](https://www.store.dsebastien.net/product/knowii-community/) and learn to organize your notes and put your knowledge to work, together with fellow knowledge workers

If this plugin is useful to you, here are the best ways to support my work ❤️:

- [Join the Knowii community](https://www.store.dsebastien.net/product/knowii-community/)
- [Become a GitHub Sponsor](https://github.com/sponsors/dsebastien)
- [Buy me a coffee](https://www.buymeacoffee.com/dsebastien)
- [Subscribe to my YouTube channel](https://youtube.com/@dsebastien)
- [Check out my products](https://store.dsebastien.net)

Found a bug or have an idea? [Open an issue](https://github.com/dsebastien/obsidian-ghost-publish/issues).
