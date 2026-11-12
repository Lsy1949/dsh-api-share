# dsh-api-share

[中文](README.zh.md) | English

[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![node: >=24](https://img.shields.io/badge/node-%3E%3D24-brightgreen.svg)](package.json)
[![dsh: 0.2.x](https://img.shields.io/badge/dsh-0.2.x-brightgreen.svg)](package.json)

Share the model provider configuration of a [DeepSeek Harness](https://github.com/deepseek-ai) profile — and take it back.

Adds an **Import / export configuration** entry at the bottom of **Settings → Models**, opening a dialog with two tabs:

- **Export**: tick the APIs (providers) and the models under each one — every API group collapses — and watch a
  paste-ready `cordis.patch.yml` snippet and a JSON document appear live. Ids that would collide with the
  receiving side get a numeric suffix, and every rename is listed in the preview.
- **Import**: paste a previously exported YAML/JSON snippet (or drop the file in), review the plan — *new,
  renamed, replaced, already there, skipped, invalid* — then write it into this profile in one click.

- **Host half**: four same-origin `POST` routes: read, compose, plan, write. There is exactly one write path —
  `configEditor.edit()`.
- **Client half**: one footer slot entry, one dialog. No third-party dependency, no bundler, no JSX.

## The dialog

```
┌──────────────────────────────────────────────────────────────┐
│ Share model configuration          [ Export | Import ] Close │
├───────────────────────────────┬──────────────────────────────┤
│ Search…      Expand all  Fold │ Export options       [YAML|JSON]│
│ APIs / models      All   None │ Name collisions ▾            │
│ ▶ Relay    openai-completions │ Preview                     │
│   ▪ 19/19                     │ ┌─────────────────────────┐ │
│ ▶ Second API  anthropic-…      │ │ - id: llm-pi-ai         │ │
│   47 catalog providers…        │ │   …                     │ │
├───────────────────────────────┴──────────────────────────────┤
│ 2 APIs · 21 models selected     [Copy YAML] [Download YAML]  │
└──────────────────────────────────────────────────────────────┘
```

- **Every group starts collapsed**; the header (chevron, name, protocol/credential/catalog badges, `selected/total`)
  toggles it.
- Inside a group there is a fixed **All / None** pair that disables itself when it would do nothing, plus that
  group's selected count.
- Above the list: **search** (provider id, display name, endpoint, model id and name), **expand all / collapse all**,
  and all/none over the current filter.
- The two columns **scroll independently**, with sticky column heads and a footer that always shows the current
  selection and the next action.
- **Copy and download follow the active tab**: YAML offers *Copy YAML* / *Download YAML* (`.yml`), JSON offers
  *Copy JSON* / *Download JSON* (`.json`).
- Escape closes the dialog, the backdrop closes it, controls are keyboard reachable, and every failure renders as a
  line of text rather than an empty box.

## Compatibility

| | |
| --- | --- |
| Verified against | DeepSeek Harness **0.2.2-rc.1** (desktop, profile `desktop`) |
| Declared range | `engines.dsh: ">=0.2.1-rc.2 <0.3.0"` |
| Node | `>=24` (the harness runtime) |
| Runtime dependencies | none |
| Platforms | any — the plugin is plain JavaScript and touches no OS API |

Compatibility is a design constraint here, not a claim:

- **No `@deepseek-ai/*` import.** Those packages live inside `app.asar`; a profile-installed plugin resolves
  plain Node specifiers and fails with `ERR_MODULE_NOT_FOUND`. Everything the plugin needs it reads through
  *services* (`settings`, `configEditor`, `loader`, `llm`, `credentials`, `webServer`).
- **Public services only, each optional.** `test/manifest.mjs` fails the build if a shipped source file grows an
  `@deepseek-ai/*` import, a YAML parser import, or a non-relative/non-`node:` import.
- **Degrade, never throw.** `apply()` never throws; a missing service leaves the export unavailable instead of
  breaking the plugin tree (a declared-but-missing `inject` would leave the Loader entry pending).
- **The manifest is what the release reads.** `dsh.manifestVersion: 1`, a bundle patch, and
  `dsh.client.platform: "web"` with a resolvable `./client` export — all asserted by the test suite.
- **The emitted YAML is verified, not assumed.** The snippet round-trips through the same `js-yaml` build the
  harness ships: the parsed result deep-equals the JSON document's `patch`.

## What it exports

Only what **you wrote in the profile patch** (the `user` layer of `settings.describe()`). Schema defaults that
schemastery materialises (`defaultContextWindow`, `streamIdleTimeoutMs`, `maxRequestImages`, …) are deliberately
left out:

```yaml
- id: llm-pi-ai
  name: "@deepseek-ai/dsh-llm-pi-ai"
  config:
    providers:
      workbuddy-api:
        apiKeyEnv: WORKBUDDY_API_API_KEY
        api: openai-completions
        baseURL: http://127.0.0.1:7863/v1
        models:
          - id: "cn:hy3"
            name: Hy3
            contextWindow: 192000
            maxTokens: 64000
```

| Case | What is written |
| --- | --- |
| The model is declared in your configuration | its `name` / `contextWindow` / `maxTokens` / `input` / `reasoningEfforts` / `compat` travel with it |
| The model comes from the installed catalog (you wrote no `models`) | only `id` — capacities stay the target catalog's job |
| The provider is only declared in another layer (bundle / home patch) | not exported; listed under "not exported" with the reason |
| A value is a `!!js` expression | not exported; listed with the reason, because an expression cannot be serialised safely |

`apiKeyEnv` is a credential **reference name**, never a secret.

### What "{count} catalog providers are still unconfigured" means

The expandable line under the list counts the providers the **installed pi-ai catalog** ships (`openai`,
`anthropic`, `groq`, `moonshotai`, `zai`… — 47 of them on a stock install) that **your profile does not
configure**:

- no `providers.<route>` entry → no `apiKeyEnv` (so no key), no `baseURL`, no chosen `models`;
- so they cannot be exported (a snippet for them would be an empty shell) and they are kept out of the tick list;
- add one in **Models settings → Add model provider** and it appears here, exportable.

The line is there so "not listed" reads as "not configured here" rather than "the plugin cannot see it"; expanding it
names them.

## Name collisions

| Mode | Behaviour | When to use it |
| --- | --- | --- |
| Rename only on a real collision (default) | the target already owns this provider id with a different `api` / `baseURL` / `apiKeyEnv` → `foo-2`, `foo-3`…; same id **and** same connection counts as "it is already this provider" and keeps its name; a model colliding with a different payload inside the same provider is suffixed too | exporting to a machine that may already have these routes |
| Always add a suffix | every provider id gets a numeric suffix (`relay` → `relay-2`) | merging this setup beside the one you already run |
| Keep every name | nothing is renamed | the target is empty |

"Target" means **this profile's live configuration** — the plugin cannot see another machine, so conflicts are
judged on local facts. Every rename appears in the YAML header comments and in the preview. A renamed provider is
a brand-new route, so its model ids keep their spelling.

## Import

Paste a snippet exported earlier (YAML or JSON — both work) into the **Import** tab, or drop a `.yml` / `.yaml` /
`.json` file onto the input.

| Collision policy | Behaviour |
| --- | --- |
| Keep existing, rename the import (default) | the provider already in the profile is untouched; the imported one becomes `foo-2`, `foo-3`… |
| Keep existing, skip the import | a colliding provider is skipped; only new ones are created |
| Overwrite with the import | a colliding provider is replaced wholesale by the snippet |

The flow is *preview first, then write*: the plan appears as you paste and labels every provider
`new / new (renamed) / replace / already there / skipped / invalid`, with its model count and the reason. The
write button stays disabled until there is something to change.

How the write happens — the only place this plugin changes local state:

- Through `configEditor.edit(entry, change)`: it takes the profile's file lock, validates the candidate through
  `llm-pi-ai`'s own schema, writes atomically, then lets the Loader re-mount; a failed reload rolls the file back.
  The plugin never edits `cordis.patch.yml` itself — it has no lock, no schema and no YAML parser for it.
- Only the `providers` dictionary of the `llm-pi-ai` row is replaced: its `retryPolicy`, `headers` and any other
  field survive, and no other row in the file is touched.
- **All or nothing**: one invalid provider (a hand-declared route without `api` / `baseURL`, for example) rejects
  the whole import and leaves the profile unchanged.
- Fields the adapter does not accept are dropped and reported; `!!js` expressions are stripped at any depth — `configEditor.edit()` turns such a node back into YAML the Loader *evaluates*, so this is a security boundary, not tidiness.
- After writing, the new routes are checked against `llm.listProviders()`: pi-ai only logs a route collision, so this turns "written but not serving" into an explicit note.
- Without `configEditor` (a non-profile composition), `catalog` reports `canWrite: false` and the UI disables the
  write button, leaving the read-only preview.

After a successful write the pi-ai adapter is re-mounted, so the new provider is served immediately; a Models
card that is already open may still hold the old snapshot — close and reopen it.

## Plaintext keys

Off by default. When you tick **Include plaintext API keys**:

- keys only appear as comment lines in the YAML header (`#   WORKBUDDY_API_API_KEY=sk-…`), never as a config
  field — `llm-pi-ai`'s schema has no key field, the credential seam owns secrets;
- that answer is only produced when the request comes from **the DSH page itself** (same-origin `Origin`); a local
  process posting directly gets `403 secrets-require-browser-origin`;
- keep the exported file private.

## Install

```powershell
# from the desktop: Settings → Plugins, or
dsh plugin --profile desktop add dsh-api-share
# straight from GitHub
dsh plugin --profile desktop add github:Lsy1949/dsh-api-share
# local development against a checkout
dsh plugin --profile desktop add link:D:\path\to\dsh-api-share
```

Remove with `dsh plugin --profile desktop remove dsh-api-share`.

## Routes

Both are same-origin `POST`, answer JSON; only `/import/apply` writes, and it requires `confirm: true`.

| Route | Body | Answer |
| --- | --- | --- |
| `POST /dsh-api-share/catalog` | `{}` | `{ ok, sources, secretsAvailable, canWrite, providers[], skipped[], dormant[], warnings[] }` |
| `POST /dsh-api-share/export` | `{ selection: [{ id, models[] }], mode: "auto"\|"always"\|"off", includeSecrets }` | `{ ok, mode, yaml, json, renames[], identical[], warnings[], providerIds[], secretsIncluded }` |
| `POST /dsh-api-share/import/preview` | `{ text, policy: "merge"\|"skip"\|"overwrite" }` | `{ ok, format, policy, entries[], summary, warnings[], canWrite, changes }` |
| `POST /dsh-api-share/import/apply` | `{ text, policy, confirm: true }` | `{ ok, applied, namespace, entries[], summary, warnings[] }` |

`sources.tier` names the layer that answered the read: `settings` (richest) → `configEditor` → `loader` → `none`.
Errors: `400 bad-body` / `400 not-confirmed`, `403 cross-origin`, `403 secrets-require-browser-origin`,
`405 method-not-allowed`, `409 write-unavailable`, `422 bad-snippet`, `422 refused` / `stale-entry` /
`overridden` / `write-failed`, `500 internal` (all with `detail`).

## Known edges

- **`llm-pi-ai` routes only.** DeepSeek account / `llm-deepseek` rows are composition facts and stay out of scope,
  as do providers another plugin injects at runtime.
- **The target is invisible.** Conflicts are judged on local facts; the export is a proposal, not a sync.
- **Catalog capacities are not exported.** Pin them by writing `models` explicitly in the configuration.
- **Import only creates and updates.** A provider the snippet does not mention is never removed; use Models
  settings for that.
- **Overwrite replaces the whole provider**: what the snippet omits (its `headers`, say) is gone. The default
  *rename* policy is the conservative choice.
- **Deleting a provider row does not clean up its credential** — this plugin never touches credentials.

## Development

```powershell
npm run check   # node --check on every shipped file
npm test        # 103 assertions across 7 suites
```

| Suite | Covers |
| --- | --- |
| `test/unit.mjs` | YAML emitter (quoting, indentation, sequence shapes) and the naming policy |
| `test/export.mjs` | selection → YAML/JSON composition, renames, secrets, refusals |
| `test/import.mjs` | the YAML reader (including its refusals), snippet intake, the three import policies |
| `test/catalog.mjs` | the read tiers, namespace isolation, `!!js` skipping, target facts, request validation, credential gating |
| `test/write.mjs` | locating the pi-ai row, the merge semantics of `configEditor.edit()`, every failure mapping |
| `test/client.mjs` | the real components mounted through a miniature renderer (`test/harness.mjs`): dialog, collapsing groups, search, export preview, import plan, validation-disabled write |
| `test/manifest.mjs` | publication and compatibility guards (manifest, exports, engines, imports, slots, routes, the single write path) plus layout guards (each column must scroll on its own, groups start collapsed) |

## Publishing checklist

1. `npm run verify` — checks plus the full suite, including the compatibility guards.
2. `npm pack --dry-run` — confirm the tarball holds `index.js`, `client.js`, `cordis.patch.yml`, `lib/**`, and the
   docs, and nothing else.
3. Bump `version` and add a `CHANGELOG.md` entry.
4. Push to GitHub and tag `v<version>`; publish to npm only if that is wanted.

Repository: <https://github.com/Lsy1949/dsh-api-share> — install with
`dsh plugin --profile desktop add github:Lsy1949/dsh-api-share`.

## License

MIT © Lsy1949
