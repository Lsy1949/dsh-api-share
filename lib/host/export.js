/**
 * dsh-api-share — turns a selection into the two artefacts the UI
 * offers: a `cordis.patch.yml` snippet and a JSON document.
 *
 * Everything here is pure. The caller supplies a catalogue (what this profile
 * can serve), a selection (which providers and models the user ticked) and what
 * the receiving side already owns, and gets back text plus a full account of
 * what changed. No service, no filesystem, no clock beyond `now`.
 */
import { resolveNames } from './naming.js';
import { toYaml } from './yaml.js';

/** The cordis entry that owns pi-ai provider routes. */
export const PATCH_ID = 'llm-pi-ai';
export const PATCH_NAME = '@deepseek-ai/dsh-llm-pi-ai';

/**
 * @typedef {object} CatalogModel
 * @property {string} id
 * @property {Record<string, unknown>} [fields] every other pi-ai model field, already cleaned
 *
 * @typedef {object} CatalogProvider
 * @property {string} id
 * @property {string} [displayName]
 * @property {string} [api]
 * @property {string} [baseURL]
 * @property {string} [apiKeyEnv]
 * @property {CatalogModel[]} models
 *
 * @typedef {{ id: string, models?: string[] | null }} SelectionEntry
 */

/**
 * The connection facts that identify a provider, in the field order
 * `cordis.patch.yml` already uses. `displayName` is a label the user wrote, not
 * a connection fact, so it is copied only when the profile declares one.
 * @param {CatalogProvider} provider
 * @returns {Record<string, string>}
 */
function factsOf(provider) {
  /** @type {Record<string, string>} */
  const facts = {};
  if (provider.apiKeyEnv) facts.apiKeyEnv = provider.apiKeyEnv;
  if (provider.api) facts.api = provider.api;
  if (provider.baseURL) facts.baseURL = provider.baseURL;
  const declaredName = provider.profile?.displayName;
  if (typeof declaredName === 'string' && declaredName !== '') facts.displayName = declaredName;
  return facts;
}

/**
 * Compose one provider's payload: facts first, then its model list.
 * @param {Record<string, string>} facts
 * @param {Array<Record<string, unknown>>} models already flat `{ id, ...fields }`
 * @returns {Record<string, unknown>}
 */
function payloadOf(facts, models) {
  return { ...facts, models };
}

/**
 * Resolve one selection against the catalog into the entries the export writes.
 * Unknown ids are reported, never invented.
 *
 * @param {Map<string, CatalogProvider>} catalog
 * @param {SelectionEntry[]} selection
 * @param {{ exact?: boolean }} [options] `exact` throws on an unknown id
 * @returns {{ providers: Array<{ id: string, facts: Record<string, string>, models: Array<{ id: string, payload: unknown }> }>, warnings: string[] }}
 */
export function reduceSelection(catalog, selection, options = {}) {
  /** @type {string[]} */
  const warnings = [];
  /** @type {Array<{ id: string, facts: Record<string, string>, models: Array<{ id: string, payload: unknown }> }>} */
  const providers = [];

  for (const entry of selection) {
    const provider = catalog.get(entry.id);
    if (provider === undefined) {
      const message = `unknown provider "${entry.id}"`;
      if (options.exact === true) throw new Error(message);
      warnings.push(message);
      continue;
    }
    const wanted = entry.models === null || entry.models === undefined
      ? provider.models.map((model) => model.id)
      : entry.models;
    const available = new Map(provider.models.map((model) => [model.id, model]));
    const models = [];
    for (const modelId of wanted) {
      const model = available.get(modelId);
      if (model === undefined) {
        const message = `unknown model "${modelId}" for provider "${provider.id}"`;
        if (options.exact === true) throw new Error(message);
        warnings.push(message);
        continue;
      }
      models.push({ id: model.id, payload: { id: model.id, ...(model.fields ?? {}) } });
    }
    if (models.length === 0) {
      warnings.push(`provider "${provider.id}" has no selected models and was skipped`);
      continue;
    }
    providers.push({ id: provider.id, facts: factsOf(provider), models });
  }

  return { providers, warnings };
}

/**
 * Compose the `cordis.patch.yml` entry from renamed providers.
 * @param {Array<{ id: string, facts: Record<string, string>, models: Array<{ id: string, payload: unknown }> }>} providers
 * @returns {Record<string, unknown>}
 */
export function composeEntry(providers) {
  /** @type {Record<string, unknown>} */
  const routes = {};
  for (const provider of providers) {
    const models = provider.models.map((model) => {
      const named = /** @type {{ id: string } & Record<string, unknown>} */ (model.payload);
      return { ...named, id: model.id };
    });
    routes[provider.id] = payloadOf(provider.facts, models);
  }
  return { id: PATCH_ID, name: PATCH_NAME, config: { providers: routes } };
}

/**
 * Comment header for the YAML snippet. Comments only: pasting the snippet keeps
 * working without them, which is the property that lets us be verbose here.
 *
 * @param {object} input
 * @param {string} input.generatedAt ISO timestamp
 * @param {{ kind: string, provider: string, from: string, to: string }[]} input.renames
 * @param {Record<string, string>} [input.secrets] credential reference -> literal key, when included
 * @param {boolean} input.secretRequested
 * @returns {string}
 */
export function header(input) {
  const lines = [
    '# dsh-api-share — 导出的模型配置 / exported model configuration',
    `# 生成时间 / generated: ${input.generatedAt}`,
    '# 用法 / usage: 把下面的条目粘到目标 profile 的 cordis.patch.yml（顶层数组）后重启 DSH。',
    "# Paste the entry below into the target profile's cordis.patch.yml (a top-level array), then restart DSH.",
  ];
  if (input.renames.length > 0) {
    lines.push('#');
    lines.push('# 为避免与目标环境重名，以下 id 已自动改名 / renamed to avoid a collision:');
    for (const rename of input.renames) {
      lines.push(`#   ${rename.kind} ${rename.provider}/${rename.from} -> ${rename.to}`);
    }
  }
  if (input.secretRequested) {
    const names = Object.keys(input.secrets ?? {});
    lines.push('#');
    if (names.length > 0) {
      lines.push('# 注意 / warning: 明文密钥已包含在内，请自行保管，不要提交到仓库。');
      lines.push('# plaintext credentials included — keep the file private. The target machine needs these variables:');
      for (const name of names) lines.push(`#   ${name}=${input.secrets?.[name]}`);
    } else {
      lines.push('# 注意 / warning: 已要求包含明文密钥，但本环境读不到任何密钥值 / no credential value could be read here.');
    }
  }
  return `${lines.join('\n')}\n`;
}

/**
 * Build both artefacts for one export request.
 *
 * @param {object} input
 * @param {Map<string, CatalogProvider>} input.catalog
 * @param {SelectionEntry[]} input.selection
 * @param {Map<string, { facts: Record<string, string>, models: Map<string, unknown> }>} [input.target]
 * @param {{ rename?: boolean, secrets?: Record<string, string> | null, secretRequested?: boolean }} [input.options]
 * @param {string} [input.generatedAt]
 * @param {string} [input.title]
 * @returns {{ yaml: string, json: string, entry: Record<string, unknown>, renames: any[], identical: string[], warnings: string[], providerIds: string[] }}
 */
export function buildExport(input) {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const reduced = reduceSelection(input.catalog, input.selection);
  if (reduced.providers.length === 0) {
    throw new Error('nothing to export: the selection resolved to no models');
  }

  const renamed = resolveNames({
    providers: reduced.providers,
    target: input.target ?? new Map(),
    options: { mode: input.options?.mode },
  });

  const secrets = input.options?.secrets ?? null;
  const mode = input.options?.mode === 'always' ? 'always' : input.options?.mode === 'off' ? 'off' : 'auto';
  const entry = composeEntry(renamed.providers);
  const yaml = header({
    generatedAt,
    renames: renamed.renames,
    secrets: secrets ?? {},
    secretRequested: input.options?.secretRequested === true,
  }) + toYaml([entry]);

  const document = {
    format: 'dsh-api-share/v1',
    generatedAt,
    title: input.title ?? 'DeepSeek Harness model configuration',
    patchFile: 'cordis.patch.yml',
    patch: [entry],
    meta: {
      naming: mode,
      providers: renamed.providers.map((provider) => ({
        id: provider.id,
        models: provider.models.map((model) => model.id),
      })),
      renames: renamed.renames,
      identical: renamed.identical,
      warnings: reduced.warnings,
      secretsIncluded: input.options?.secretRequested === true && secrets !== null,
    },
  };

  return {
    yaml,
    json: `${JSON.stringify(document, null, 2)}\n`,
    entry,
    renames: renamed.renames,
    identical: renamed.identical,
    warnings: reduced.warnings,
    providerIds: renamed.providers.map((provider) => provider.id),
  };
}

export default { buildExport, reduceSelection, composeEntry, header, PATCH_ID, PATCH_NAME };
