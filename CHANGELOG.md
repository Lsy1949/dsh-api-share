# Changelog

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/Lsy1949/dsh-api-share/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Lsy1949/dsh-api-share/releases/tag/v0.1.0
