# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0](https://github.com/dsebastien/obsidian-ghost-publish/compare/0.9.0...1.0.0) (2026-08-29)

### ⚠ BREAKING CHANGES

* **plugin:** minAppVersion is now 1.13.0 (was 1.8.7). The settings pane
uses the declarative settings API introduced in Obsidian 1.13.

- getSettingDefinitions() replaces the imperative render path: 8 groups
  (Ghost, Public mirror, Triage, Content processing, Frontmatter properties,
  Tags & newsletters cache, Presets, Advanced, Support) with every declared
  name/desc indexed by the settings search.
- The Ghost Admin API key stays a render: row with a password input — the
  declarative text control cannot render one, and the key must never appear
  in clear text.
- excludedFolders, stripSections and knownUrls become textarea controls that
  serialize in getControlValue and parse in setControlValue (malformed
  known-URL lines are dropped, exactly as before). URL fields normalize
  (trim + trailing slashes) in setControlValue.
- The 10 frontmatter property names are text controls behind
  frontmatter.<field> keys, validated against the known field list.
- The preset list keeps its custom row UI (enable toggle, move, edit-in-modal,
  confirmed delete) inside one render: row — the native list's delete
  affordance would bypass the confirmation modal. Structural preset edits are
  serialized behind a latch, mutate the committed draft inside the mutator,
  and refresh the view + pane only AFTER the write lands; a failed write shows
  a notice and keeps the pane instead of discarding state.
- The cache section's refresh persists through the serialized write path, so
  a settings edit can no longer clobber a concurrent cache refresh (both used
  to produce from the same stale base).
- updateSettings becomes the serialized persist-then-commit write path from
  the template; saveSettings is documented as load-time-only.
- Support block and preset editor rows get block layout via an unlayered
  .setting-item.gp-settings-embed rule.
- Tests: settings-guard.spec.ts + settings-write.spec.ts (15 behavioral
  tests: queue, rollback, normalization, textarea round-trips, dot-key
  validation, preset latch; mutation-checked against an optimistic commit,
  an unserialized chain, and a removed latch — each breaks at least one test).
- Docs: README and docs/configuration.md state the 1.13 requirement;
  AGENTS.md gains the declarative-settings section with the repo-specific
  shapes (password row, preset editor, textarea serialization, plugin-owned
  caches).

### Features

* **plugin:** declare the settings tab (Obsidian 1.13 declarative settings) ([305049e](https://github.com/dsebastien/obsidian-ghost-publish/commit/305049e4f5d78a2730212fa8641331f68a86109b))
* **plugin:** show what's new in a tab instead of a modal dialog ([55d9e86](https://github.com/dsebastien/obsidian-ghost-publish/commit/55d9e860c62dbcceb9a27970fc523b53d7f29129))
* **plugin:** surface support CTAs everywhere users can see them ([1e92133](https://github.com/dsebastien/obsidian-ghost-publish/commit/1e921331be57410b1d6d67f9a54b14a77380638b))

### Bug Fixes

* **build:** align with the catalog reviewer's archive, ruleset and audit ([2809253](https://github.com/dsebastien/obsidian-ghost-publish/commit/2809253f52f5ec419eff83f7f55da7508c94c5ea))
* **plugin:** harden the settings write paths after adversarial review ([3024032](https://github.com/dsebastien/obsidian-ghost-publish/commit/30240320d9abc8a315130e2037c9ab4adbd92364))
* **release:** unattended-flag fixes from the template ([0cead60](https://github.com/dsebastien/obsidian-ghost-publish/commit/0cead60c9d0c5cb18e9d010471667c0d4afce05f))

## [0.9.0](https://github.com/dsebastien/obsidian-ghost-publish/compare/0.8.0...0.9.0) (2026-07-29)

### Features

* **plugin:** aggregate what's new dialogs across simultaneously updated plugins ([d3207f8](https://github.com/dsebastien/obsidian-ghost-publish/commit/d3207f83cdda44d87ccbcdac44a0b40b55378cb6))

## [0.8.0](https://github.com/dsebastien/obsidian-ghost-publish/compare/0.7.0...0.8.0) (2026-07-29)

### Features

* **plugin:** add Knowii community to the what's new dialog and harden it ([b8ebfd5](https://github.com/dsebastien/obsidian-ghost-publish/commit/b8ebfd53e41e27b0816435abdf47b94818a0cca7))
* **plugin:** add Knowii community to the what's new dialog and harden it ([33ef8cf](https://github.com/dsebastien/obsidian-ghost-publish/commit/33ef8cf0dd40300e76ae0fa1e22cf46d3153d4cc))

## [0.7.0](https://github.com/dsebastien/obsidian-ghost-publish/compare/0.6.1...0.7.0) (2026-07-27)

### Features

* **plugin:** show a what's new dialog once after plugin updates ([dc2d7d2](https://github.com/dsebastien/obsidian-ghost-publish/commit/dc2d7d2137e1e3b7a4852fc060e39b46d4047467))

### Bug Fixes

* **plugin:** compile against public Obsidian typings (1.12.0) ([3e238e2](https://github.com/dsebastien/obsidian-ghost-publish/commit/3e238e2e0fdf125de0387f57a27eae65c1847d36))

## [0.6.1](https://github.com/dsebastien/obsidian-ghost-publish/compare/0.6.0...0.6.1) (2026-07-17)

## [0.6.0](https://github.com/dsebastien/obsidian-ghost-publish/compare/0.5.1...0.6.0) (2026-06-30)

### Features

* **plugin:** add fuzzy search box to filter the active panel view ([6026d03](https://github.com/dsebastien/obsidian-ghost-publish/commit/6026d0342cc8e7b998b1e5c052e82465f7d2ad22))

## [0.5.1](https://github.com/dsebastien/obsidian-ghost-publish/compare/0.5.0...0.5.1) (2026-06-17)

### Bug Fixes

* **plugin:** resolve community-catalog review warnings ([39dd1ac](https://github.com/dsebastien/obsidian-ghost-publish/commit/39dd1ac2266639e98047bc074c189fb8c8953981))

## [0.5.0](https://github.com/dsebastien/obsidian-ghost-publish/compare/0.4.1...0.5.0) (2026-06-17)

### Features

* **plugin:** add Markdown footnote support ([8f18e19](https://github.com/dsebastien/obsidian-ghost-publish/commit/8f18e19cc8dd2def4a2baac32ce50239582b2af5)), closes [#1](https://github.com/dsebastien/obsidian-ghost-publish/issues/1)

## [0.4.1](https://github.com/dsebastien/obsidian-ghost-publish/compare/0.4.0...0.4.1) (2026-06-03)

### Bug Fixes

* **all:** fix plugin loading after latest Obsidian release search screen changes ([ba4db34](https://github.com/dsebastien/obsidian-ghost-publish/commit/ba4db34945e748bc5d117634b76afb21e3630e8b))

## [0.4.0](https://github.com/dsebastien/obsidian-ghost-publish/compare/0.3.0...0.4.0) (2026-06-02)

### Features

* **all:** removed notification when clicking on ignore in the triage tab ([92362a2](https://github.com/dsebastien/obsidian-ghost-publish/commit/92362a22273b94d49f311942c9b9da5123addfb9))

## [0.3.0](https://github.com/dsebastien/obsidian-ghost-publish/compare/0.2.0...0.3.0) (2026-06-02)

### Features

* **all:** improved UI ([9ba0922](https://github.com/dsebastien/obsidian-ghost-publish/commit/9ba0922cef0f7da1ebbe13bf67039896d82b8686))

## [0.2.0](https://github.com/dsebastien/obsidian-ghost-publish/compare/0.1.1...0.2.0) (2026-05-19)

### Features

* **plugin:** hide synced notes by default in the Queue tab ([6b26182](https://github.com/dsebastien/obsidian-ghost-publish/commit/6b261829dda538ad42aa624edfca5eca8d8277ce))

### Bug Fixes

* **plugin:** hand cursor on buttons + post-sync queue refresh ([09666ea](https://github.com/dsebastien/obsidian-ghost-publish/commit/09666ea00e53ee45a2768b68f618543e0698d878))
* **plugin:** mark regenerated listing note as ignored ([4b3e081](https://github.com/dsebastien/obsidian-ghost-publish/commit/4b3e081464293ed33ae781f4ef89b70ad40f7721))
* **plugin:** standard click semantics on panel note titles ([6d969ff](https://github.com/dsebastien/obsidian-ghost-publish/commit/6d969ff2c0383e0e9cd2511b856a04ea59954ce8))

## [0.1.1](https://github.com/dsebastien/obsidian-ghost-publish/compare/0.1.0...0.1.1) (2026-05-19)

### Bug Fixes

* **plugin:** preserve scroll on triage and queue actions ([cd6318e](https://github.com/dsebastien/obsidian-ghost-publish/commit/cd6318ef3112b40d5b362f8a3435a52798df4a77))

## 0.1.0 (2026-05-19)

### Features

* **plugin:** implement Ghost Publish with configurable presets ([abf2e2c](https://github.com/dsebastien/obsidian-ghost-publish/commit/abf2e2cb907220e8793b0198c1d13c41acccadd4))













