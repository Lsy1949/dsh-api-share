# dsh-api-share

[中文](README.zh.md) | English

Share the model provider configuration of a [DeepSeek Harness](https://github.com/deepseek-ai) profile.

Adds an **Export configuration** entry at the bottom of **Settings → Models**: tick the APIs (providers) you want
and the models under each one, watch a paste-ready `cordis.patch.yml` snippet and a JSON document appear live, and
let ids that would collide with the receiving side get a numeric suffix automatically — every rename is listed in
the preview.

- **Host half**: two same-origin `POST` routes that read the profile's own configuration and compose the two
  artefacts. It writes nothing, touches no file, and never edits the profile.
- **Client half**: one footer slot entry, one dialog. No third-party dependency, no bundler, no JSX.

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

## Name collisions

| Mode | Behaviour | When to use it |
| --- | --- | --- |
| Rename only on a real collision (default) | the target already owns this provider id with a different `api` / `baseURL` / `apiKeyEnv` → `foo-2`, `foo-3`…; same id **and** same connection counts as "it is already this provider" and keeps its name; a model colliding with a different payload inside the same provider is suffixed too | exporting to a machine that may already have these routes |
| Always add a suffix | every provider id gets a numeric suffix (`relay` → `relay-2`) | merging this setup beside the one you already run |
| Keep every name | nothing is renamed | the target is empty |

"Target" means **this profile's live configuration** — the plugin cannot see another machine, so conflicts are
judged on local facts. Every rename appears in the YAML header comments and in the preview. A renamed provider is
a brand-new route, so its model ids keep their spelling.

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
# local development against a checkout
dsh plugin --profile desktop add link:D:\path\to\dsh-api-share
```

Remove with `dsh plugin --profile desktop remove dsh-api-share`.

## Routes

Both are same-origin `POST`, answer JSON, and write nothing.

| Route | Body | Answer |
| --- | --- | --- |
| `POST /dsh-api-share/catalog` | `{}` | `{ ok, sources, secretsAvailable, providers[], skipped[], dormant[], warnings[] }` |
| `POST /dsh-api-share/export` | `{ selection: [{ id, models[] }], mode: "auto"\|"always"\|"off", includeSecrets }` | `{ ok, mode, yaml, json, renames[], identical[], warnings[], providerIds[], secretsIncluded }` |

`sources.tier` names the layer that answered the read: `settings` (richest) → `configEditor` → `loader` → `none`.
Errors: `400 bad-body`, `403 cross-origin`, `403 secrets-require-browser-origin`, `405 method-not-allowed`,
`500 internal` (with `detail`).

## Known edges

- **`llm-pi-ai` routes only.** DeepSeek account / `llm-deepseek` rows are composition facts and stay out of scope,
  as do providers another plugin injects at runtime.
- **The target is invisible.** Conflicts are judged on local facts; the export is a proposal, not a sync.
- **Catalog capacities are not exported.** Pin them by writing `models` explicitly in the configuration.
- **Deleting a provider row does not clean up its credential** — this plugin never writes the profile.

## Development

```powershell
npm run check   # node --check on every shipped file
npm test        # 56 assertions across 5 suites
```

| Suite | Covers |
| --- | --- |
| `test/unit.mjs` | YAML emitter (quoting, indentation, sequence shapes) and the naming policy |
| `test/export.mjs` | selection → YAML/JSON composition, renames, secrets, refusals |
| `test/catalog.mjs` | the read tiers, `!!js` skipping, target facts, request validation, credential gating |
| `test/client.mjs` | the browser bundle activating, registering and rendering inside a fake module loader |
| `test/manifest.mjs` | publication and compatibility guards (manifest, exports, engines, imports, slots, routes) |

## Publishing checklist

1. `npm run verify` — checks plus the full suite, including the compatibility guards.
2. `npm pack --dry-run` — confirm the tarball holds `index.js`, `client.js`, `cordis.patch.yml`, `lib/**`, and the
   docs, and nothing else.
3. Bump `version` and add a `CHANGELOG.md` entry.
4. `npm publish` and tag the commit; the repository URL lives in `package.json`.

## License

MIT © Lsy1949
