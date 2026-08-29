# Release Notes

## 1.0.0 (2026-08-29)

### ⚠ BREAKING CHANGES

- **plugin:** minAppVersion is now 1.13.0 (was 1.8.7). The settings pane
  uses the declarative settings API introduced in Obsidian 1.13.

* getSettingDefinitions() replaces the imperative render path: 8 groups
  (Ghost, Public mirror, Triage, Content processing, Frontmatter properties,
  Tags & newsletters cache, Presets, Advanced, Support) with every declared
  name/desc indexed by the settings search.
* The Ghost Admin API key stays a render: row with a password input — the
  declarative text control cannot render one, and the key must never appear
  in clear text.
* excludedFolders, stripSections and knownUrls become textarea controls that
  serialize in getControlValue and parse in setControlValue (malformed
  known-URL lines are dropped, exactly as before). URL fields normalize
  (trim + trailing slashes) in setControlValue.
* The 10 frontmatter property names are text controls behind
  frontmatter.<field> keys, validated against the known field list.
* The preset list keeps its custom row UI (enable toggle, move, edit-in-modal,
  confirmed delete) inside one render: row — the native list's delete
  affordance would bypass the confirmation modal. Structural preset edits are
  serialized behind a latch, mutate the committed draft inside the mutator,
  and refresh the view + pane only AFTER the write lands; a failed write shows
  a notice and keeps the pane instead of discarding state.
* The cache section's refresh persists through the serialized write path, so
  a settings edit can no longer clobber a concurrent cache refresh (both used
  to produce from the same stale base).
* updateSettings becomes the serialized persist-then-commit write path from
  the template; saveSettings is documented as load-time-only.
* Support block and preset editor rows get block layout via an unlayered
  .setting-item.gp-settings-embed rule.
* Tests: settings-guard.spec.ts + settings-write.spec.ts (15 behavioral
  tests: queue, rollback, normalization, textarea round-trips, dot-key
  validation, preset latch; mutation-checked against an optimistic commit,
  an unserialized chain, and a removed latch — each breaks at least one test).
* Docs: README and docs/configuration.md state the 1.13 requirement;
  AGENTS.md gains the declarative-settings section with the repo-specific
  shapes (password row, preset editor, textarea serialization, plugin-owned
  caches).

### Features

- **plugin:** declare the settings tab (Obsidian 1.13 declarative settings)
- **plugin:** show what's new in a tab instead of a modal dialog
- **plugin:** surface support CTAs everywhere users can see them

### Bug Fixes

- **build:** align with the catalog reviewer's archive, ruleset and audit
- **plugin:** harden the settings write paths after adversarial review
- **release:** unattended-flag fixes from the template

## 0.9.0 (2026-07-29)

### Features

- **plugin:** aggregate what's new dialogs across simultaneously updated plugins

## 0.8.0 (2026-07-29)

### Features

- **plugin:** add Knowii community to the what's new dialog and harden it
- **plugin:** add Knowii community to the what's new dialog and harden it

## 0.7.0 (2026-07-27)

### Features

- **plugin:** show a what's new dialog once after plugin updates

### Bug Fixes

- **plugin:** compile against public Obsidian typings (1.12.0)

## 0.6.1 (2026-07-17)

## 0.6.0 (2026-06-30)

### Features

- **plugin:** add fuzzy search box to filter the active panel view

## 0.5.1 (2026-06-17)

### Bug Fixes

- **plugin:** resolve community-catalog review warnings

## 0.5.0 (2026-06-17)

### Features

- **plugin:** add Markdown footnote support

## 0.4.1 (2026-06-03)

### Bug Fixes

- **all:** fix plugin loading after latest Obsidian release search screen changes

## 0.4.0 (2026-06-02)

### Features

- **all:** removed notification when clicking on ignore in the triage tab

## 0.3.0 (2026-06-02)

### Features

- **all:** improved UI

## 0.2.0 (2026-05-19)

### Features

- **plugin:** hide synced notes by default in the Queue tab

### Bug Fixes

- **plugin:** hand cursor on buttons + post-sync queue refresh
- **plugin:** mark regenerated listing note as ignored
- **plugin:** standard click semantics on panel note titles

## 0.1.1 (2026-05-19)

### Bug Fixes

- **plugin:** preserve scroll on triage and queue actions

## 0.1.0 (2026-05-19)

### Features

- **plugin:** implement Ghost Publish with configurable presets
