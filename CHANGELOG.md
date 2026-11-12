# Changelog

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.3] - 2026-11-12

**First published release.** It folds the layout and interaction work that was developed locally as 0.2.1 and
0.2.2: scrollable columns, a definite dialog height, a full-width action bar, collapsed groups by default,
format-aware copy/download, and an explainable "unconfigured catalog providers" line.

### Fixed

- An expanded API group's model list still would not scroll: the scroll column is a flex column, its children shrink by default, and a child with `overflow: hidden` may shrink to zero — so the groups compressed and the column never overflowed. Children now keep their content height (`flex: 0 0 auto`), the preview is the one child allowed to grow, and the scroll area is bounded by its own column (`max-height: 100%`) instead of a viewport guess.
- A group's select-all control flipped its own label once everything was selected, so the row showed two buttons reading "清空". The group now offers a fixed **全选** / **清空** pair that disables itself when it would do nothing, plus a `selected / total` count.
- The dialog collapsed to a sliver: the body was `flex: 1` inside a dialog that only declared `max-height`, so the grid had no definite height to divide and both columns were squashed. The dialog now declares a definite
  `height: min(88vh, 920px)` and the body's rows are `minmax(0, 1fr) auto`.
- The provider column could not scroll: the dialog's grid row was content-sized, so a `flex: 1; overflow: auto`
  list grew past the dialog and was clipped by it. Each column now owns its scroll area, and layout guards in
  `test/manifest.mjs` keep it that way.
- The action bar only spanned the right column; it is now a grid row across the whole dialog
  (`grid-column: 1 / -1`).
- The left column's heading said "预览"; it now names what it holds ("API / 模型").

### Changed

- Every API group starts **collapsed**; the dialog lists provider headers only until you open one.
- The copy and download buttons follow the selected preview tab: YAML offers *Copy / Download YAML* (`.yml`), JSON
  offers *Copy / Download JSON* (`.json`), instead of always copying YAML and downloading JSON.
- The "N catalog providers are unconfigured" hint is now an expandable explanation that names them and says why
  they cannot be exported.

## [0.2.0] - 2026-11-12

### Added

- **Import tab**: paste a previously exported YAML snippet or JSON document (or drop the file in), review the plan
  and write it into the profile. Three collision policies — rename the import (default), skip it, or overwrite —
  and the plan labels every provider `new / new (renamed) / replace / already there / skipped / invalid` before
  anything is written.
- A dependency-free YAML reader for the dialect this plugin emits (block mappings and sequences, inline scalar
  sequences, quoting, comments) that refuses anything outside it with a line number.
- `POST /import/preview` and `POST /import/apply`; `catalog` now reports `canWrite` so the UI can disable the
  import when the composition has no writable configuration row.
- The write path is `configEditor.edit()` only — validated by the adapter's own schema, file-locked, atomic, rolled
  back on a failed reload — and it replaces just the `providers` dictionary of the `llm-pi-ai` row.
- Pre-write validation in the preview: the adapter's own `resolveConfig` gate runs without publishing, so the
  dialog shows its exact wording and disables the write button instead of letting the user discover the refusal.
- Post-write verification: every created or renamed route is checked against `llm.listProviders()`, because pi-ai
  logs a route collision rather than failing — "written but not serving" is now a visible note.
- `!!js` expressions are stripped at every depth of an imported snippet: `configEditor.edit()` turns such a node
  back into YAML the Loader evaluates, so this is a code-execution boundary, not tidiness.
- A miniature renderer (`test/harness.mjs`) mounts the real components, so the dialog, the collapsing API groups,
  the search box, the export preview, the import plan and the disabled write button are all covered by tests.

### Changed

- The dialog is now two tabs (**Export** / **Import**) with a shared header, sticky column headers and a footer
  that always shows the pending action.
- Each API group collapses: a chevron header with protocol, credential and catalog badges, a selected/total count,
  plus search, expand-all/collapse-all and per-group select-all/none.
- Bigger, calmer layout: card surfaces and design tokens (`--dsw-*`) instead of ad-hoc colours, monospace previews,
  explicit empty/loading/error states, `role="status"` announcements, and keyboard-reachable controls throughout.
- 85 assertions across 7 suites, including new guards for the YAML reader, the import planner, the write path and
  "only `write.js` may edit configuration".

## [0.1.0] - 2026-11-12

### Added

- **Export configuration** entry at the bottom of **Settings → Models** (`settings.models.footer`), opening a
  dialog that selects providers and their models and previews the result live.
- YAML artefact: one paste-ready `llm-pi-ai` patch row; JSON artefact: a versioned document carrying the same
  patch plus metadata. Copy the YAML, or download the JSON.
- Adaptive naming with three modes (`auto`, `always`, `off`): ids that collide with the profile's existing
  connection facts get a numeric suffix, and every rename is reported in the header and the preview.
- Optional plaintext credentials in the YAML header, returned only to same-origin page requests.
- Host routes `POST /dsh-api-share/catalog` and `POST /dsh-api-share/export`, same-origin, JSON-only, write-free.
- Dependency-free YAML emitter and a three-tier reader (`settings` → `configEditor` → `loader`) that degrades to an
  explained empty catalogue instead of failing.
- Test suite: YAML/naming unit tests, export composition, the collection layer with fake services, a browser-bundle
  smoke test in a fake module loader, and publication/compatibility guards.

[Unreleased]: https://github.com/Lsy1949/dsh-api-share/compare/v0.2.3...HEAD
[0.2.3]: https://github.com/Lsy1949/dsh-api-share/releases/tag/v0.2.3
[0.2.0]: https://github.com/Lsy1949/dsh-api-share/releases/tag/v0.2.0
[0.1.0]: https://github.com/Lsy1949/dsh-api-share/releases/tag/v0.1.0
