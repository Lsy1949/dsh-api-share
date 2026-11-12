/**
 * dsh-api-share — where the exportable facts come from.
 *
 * A third-party plugin cannot import `@deepseek-ai/*` (they live inside
 * `app.asar`), so the catalogue is assembled from services, in order of
 * richness:
 *
 *   1. `settings.describe({ redactSecrets: true })` — one descriptor per active
 *      entry id. `user` is exactly the profile patch row's `config:` block (the
 *      text the user actually wrote); `value` is the live, *defaults-materialised*
 *      view. **Export `user`; read `value` only for display and conflict checks.**
 *   2. `configEditor.configuration()` — `{ entry, inherited, override }` per row.
 *   3. `loader.entries()` — `entry.options.config`, always present.
 *
 * `llm` contributes identity only (`listConfigurableProviders()`): display
 * names, catalog endpoints and native-auth hints. `llm.listModels()` is never
 * used: it returns no capacities and an empty list whenever the route's
 * credential does not resolve.
 *
 * Everything is normalized into:
 *   { id, displayName, api, baseURL, apiKeyEnv, profile, models: [{ id, fields, origin }] }
 * where `origin: 'declared'` means the user wrote the model and its fields are
 * exported, and `origin: 'catalog'` means the model comes from the installed
 * catalog and only its id may be exported.
 */

/**
 * Provider fields `llm-pi-ai`'s schema accepts. Anything else is dropped from
 * the export so a pasted snippet always validates.
 */
const PROVIDER_KEYS = [
  'apiKeyEnv',
  'displayName',
  'api',
  'baseURL',
  'models',
  'modelOverrides',
  'compat',
  'defaultContextWindow',
  'defaultMaxTokens',
  'defaultInput',
  'headers',
  'reasoning',
  'thinkingBudgets',
  'cacheRetention',
  'transport',
  'timeoutMs',
  'websocketConnectTimeoutMs',
  'streamIdleTimeoutMs',
  'maxRequestImageBytes',
  'maxRequestImages',
  'imageOffloadCountQuantum',
  'requestImagePixelBudget',
  'requestImageMaxBytes',
  'retryPolicy',
];

/** Model fields `llm-pi-ai`'s `modelProfile` accepts. */
const MODEL_KEYS = ['id', 'name', 'contextWindow', 'maxTokens', 'input', 'reasoningEfforts', 'compat'];

/** @param {unknown} value */
export function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Whether a value is a `!!js` expression node, which must never be serialized.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isExpression(value) {
  return isPlainObject(value) && Object.prototype.hasOwnProperty.call(value, '__jsExpr');
}

/** Values a live config reference exposes through `.get()`. */
function isConfigReference(value) {
  return value !== null && typeof value === 'object' && typeof value.get === 'function' && typeof value.set === 'function';
}

/**
 * Turn live config (which may hold Config references) into plain JSON.
 * @param {unknown} value
 * @param {number} [depth]
 * @returns {unknown}
 */
export function plain(value, depth = 0) {
  if (depth > 12) return undefined;
  if (value === null || typeof value !== 'object') return value;
  if (isConfigReference(value)) {
    try {
      return plain(value.get(), depth + 1);
    } catch {
      return undefined;
    }
  }
  if (Array.isArray(value)) return value.map((item) => plain(item, depth + 1));
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    const next = plain(item, depth + 1);
    if (next !== undefined) out[key] = next;
  }
  return out;
}

/**
 * Deep-merge two plain config layers: objects merge, everything else replaces.
 * @param {Record<string, unknown>} base
 * @param {Record<string, unknown>} over
 * @returns {Record<string, unknown>}
 */
export function mergeConfig(base, over) {
  const out = { ...base };
  for (const [key, value] of Object.entries(over)) {
    const current = out[key];
    out[key] = isPlainObject(current) && isPlainObject(value) ? mergeConfig(current, value) : value;
  }
  return out;
}

/**
 * Keep only the fields the adapter accepts.
 * @param {Record<string, unknown>} source
 * @param {string[]} keys
 * @returns {Record<string, unknown>}
 */
function pick(source, keys) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of keys) {
    const value = source[key];
    if (value === undefined || value === null) continue;
    if (isExpression(value)) continue;
    out[key] = value;
  }
  return out;
}

/**
 * Normalize one declared model entry, keeping only adapter fields.
 * @param {unknown} raw
 * @param {'declared' | 'catalog'} origin
 * @returns {{ id: string, fields: Record<string, unknown>, origin: 'declared' | 'catalog' } | null}
 */
function normalizeModel(raw, origin) {
  if (!isPlainObject(raw)) return null;
  if (typeof raw.id !== 'string' || raw.id.length === 0) return null;
  if (isExpression(raw)) return null;
  const { id, ...rest } = pick(raw, MODEL_KEYS);
  return { id: String(id), fields: origin === 'declared' ? rest : {}, origin };
}

/**
 * Models from one layer: declared entries keep their fields, catalog-derived
 * entries never do (their capacities are the target catalog's business).
 * @param {unknown} list
 * @param {'declared' | 'catalog'} origin
 * @returns {Array<{ id: string, fields: Record<string, unknown>, origin: 'declared' | 'catalog' }>}
 */
function normalizeModels(list, origin) {
  if (!Array.isArray(list)) return [];
  /** @type {Map<string, any>} */
  const seen = new Map();
  for (const raw of list) {
    const model = normalizeModel(raw, origin);
    if (model === null) continue;
    if (!seen.has(model.id)) seen.set(model.id, model);
  }
  return [...seen.values()];
}

/**
 * Whether a name belongs to the pi-ai adapter.
 * @param {string} name
 * @returns {boolean}
 */
function isPiAiName(name) {
  return name === '@deepseek-ai/dsh-llm-pi-ai' || name.endsWith('/dsh-llm-pi-ai');
}

/**
 * Every pi-ai namespace in this composition, from the directory when possible.
 * The namespace is the loader entry id, which a user may re-id, so it is never
 * assumed to be `llm-pi-ai`.
 * @param {Map<string, any>} directory
 * @param {any} loader
 * @returns {Set<string>}
 */
function piAiNamespaces(directory, loader) {
  const namespaces = new Set();
  for (const entry of directory.values()) {
    if (typeof entry?.settingsNs === 'string' && entry.settingsNs !== '') namespaces.add(entry.settingsNs);
  }
  if (namespaces.size > 0) return namespaces;
  /* Fallback: ask the loader which entries run the pi-ai package. */
  try {
    for (const entry of loader?.entries?.() ?? []) {
      const name = typeof entry?.options?.name === 'string' ? entry.options.name : '';
      const id = typeof entry?.options?.id === 'string' ? entry.options.id : '';
      if (isPiAiName(name) && id !== '') namespaces.add(id);
    }
  } catch {
    /* no loader: the caller degrades to an empty catalogue */
  }
  return namespaces;
}

/**
 * Descriptors from the settings service, keyed by namespace.
 * @param {any} settings
 * @returns {{ byNs: Map<string, any>, error: string }}
 */
function readDescriptors(settings) {
  /** @type {Map<string, any>} */
  const byNs = new Map();
  if (settings === null || settings === undefined || typeof settings.describe !== 'function') {
    return { byNs, error: '' };
  }
  let list;
  try {
    list = settings.describe({ redactSecrets: true });
  } catch (error) {
    return { byNs, error: error instanceof Error ? error.message : String(error) };
  }
  if (!Array.isArray(list)) return { byNs, error: '' };
  for (const descriptor of list) {
    if (!isPlainObject(descriptor) || typeof descriptor.ns !== 'string') continue;
    byNs.set(descriptor.ns, descriptor);
  }
  return { byNs, error: '' };
}

/**
 * The `providers` dict of one descriptor layer.
 * @param {any} layer
 * @returns {Record<string, unknown>}
 */
function providersOf(layer) {
  const plainLayer = plain(layer);
  if (!isPlainObject(plainLayer)) return {};
  return isPlainObject(plainLayer.providers) ? plainLayer.providers : {};
}

/**
 * Whether a descriptor is a provider-configuration section at all.
 * @param {any} descriptor
 * @returns {boolean}
 */
function descriptorCarriesProviders(descriptor) {
  return Object.keys(providersOf(descriptor?.user)).length > 0 || Object.keys(providersOf(descriptor?.value)).length > 0;
}

/**
 * Route metadata from the adapter registry, keyed by provider.
 * @param {any} llm
 * @returns {Map<string, any>}
 */
function readDirectory(llm) {
  /** @type {Map<string, any>} */
  const out = new Map();
  if (llm === null || llm === undefined || typeof llm.listConfigurableProviders !== 'function') return out;
  try {
    for (const entry of llm.listConfigurableProviders() ?? []) {
      if (typeof entry?.provider !== 'string' || entry.provider === '') continue;
      out.set(entry.provider, entry);
    }
  } catch {
    /* the directory is optional */
  }
  return out;
}

/**
 * Whether the credential seam can resolve a reference (never its value).
 * @param {any} credentials
 * @param {string} ref
 * @returns {Promise<{ configured: boolean, value?: string }>}
 */
async function readCredential(credentials, ref) {
  if (credentials === null || credentials === undefined || ref === '') return { configured: false };
  if (typeof credentials.resolve === 'function') {
    try {
      const resolved = await credentials.resolve(ref);
      if (isPlainObject(resolved) && typeof resolved.value === 'string') {
        return { configured: true, value: resolved.value };
      }
      return { configured: false };
    } catch {
      return { configured: false };
    }
  }
  if (typeof credentials.describe === 'function') {
    try {
      const described = await credentials.describe(ref);
      return { configured: described?.configured === true };
    } catch {
      return { configured: false };
    }
  }
  return { configured: false };
}

/**
 * Build the catalogue for one read.
 *
 * @param {any} ctx cordis host context
 * @param {{ withSecrets?: boolean }} [options]
 * @returns {Promise<{
 *   providers: Map<string, any>,
 *   view: any[],
 *   skipped: any[],
 *   sources: Record<string, unknown>,
 *   secrets: Record<string, string>,
 *   secretsAvailable: boolean,
 *   warnings: string[],
 * }>}
 */
export async function readCatalog(ctx, options = {}) {
  const get = (name) => {
    try {
      return typeof ctx?.get === 'function' ? ctx.get(name) : undefined;
    } catch {
      return undefined;
    }
  };

  const settings = get('settings');
  const llm = get('llm');
  const credentials = get('credentials');
  const loader = get('loader');
  const configEditor = get('configEditor');

  const directory = readDirectory(llm);
  const namespaces = piAiNamespaces(directory, loader);
  const descriptors = readDescriptors(settings);

  /** @type {string[]} */
  const warnings = [];
  if (descriptors.error !== '') warnings.push(`settings.describe() failed: ${descriptors.error}`);

  /** @type {Record<string, unknown>} */
  const sources = {
    settings: settings !== undefined && settings !== null,
    configEditor: configEditor !== undefined && configEditor !== null,
    llm: llm !== undefined && llm !== null,
    credentials: credentials !== undefined && credentials !== null,
    namespaces: [...namespaces],
    tier: 'none',
  };

  /** @type {Array<{ ns: string, user: Record<string, unknown>, value: Record<string, unknown> }>} */
  const sections = [];
  /* A section counts as pi-ai-shaped when it carries a `providers` dict. The
     directory is authoritative for the namespace, but a composition whose
     directory has not settled yet still exports correctly through this test. */
  for (const [ns, descriptor] of descriptors.byNs) {
    if (!namespaces.has(ns) && !descriptorCarriesProviders(descriptor)) continue;
    const user = providersOf(descriptor.user);
    const value = providersOf(descriptor.value);
    if (Object.keys(user).length === 0 && Object.keys(value).length === 0) continue;
    sections.push({ ns, user, value });
    if (!namespaces.has(ns)) namespaces.add(ns);
  }
  if (sections.length > 0) sources.tier = 'settings';
  sources.namespaces = [...namespaces];

  /* Fallback tiers: config editor, then the loader. Both expose the profile
     patch row's config without schema defaults. */
  if (sections.length === 0 && configEditor !== undefined && configEditor !== null && typeof configEditor.configuration === 'function') {
    try {
      for (const row of configEditor.configuration() ?? []) {
        const ns = typeof row?.entry?.options?.id === 'string' ? row.entry.options.id : '';
        const name = typeof row?.entry?.options?.name === 'string' ? row.entry.options.name : '';
        if (ns === '' || (!isPiAiName(name) && !namespaces.has(ns))) continue;
        const override = providersOf(row.override);
        const inherited = providersOf(row.inherited);
        if (Object.keys(override).length === 0 && Object.keys(inherited).length === 0) continue;
        sections.push({ ns, user: override, value: mergeConfig(inherited, override) });
      }
      if (sections.length > 0) sources.tier = 'configEditor';
    } catch (error) {
      warnings.push(`configEditor.configuration() failed: ${messageOf(error)}`);
    }
  }

  if (sections.length === 0) {
    try {
      for (const entry of loader?.entries?.() ?? []) {
        const name = typeof entry?.options?.name === 'string' ? entry.options.name : '';
        const ns = typeof entry?.options?.id === 'string' ? entry.options.id : '';
        if (ns === '' || !isPiAiName(name)) continue;
        const config = providersOf(entry.options.config ?? entry.fiber?.config);
        if (Object.keys(config).length === 0) continue;
        sections.push({ ns, user: config, value: config });
      }
      if (sections.length > 0) sources.tier = 'loader';
    } catch (error) {
      warnings.push(`loader.entries() failed: ${messageOf(error)}`);
    }
  }

  /** @type {Map<string, any>} */
  const providers = new Map();
  /** @type {any[]} */
  const skipped = [];
  /** @type {Record<string, string>} */
  const secrets = {};
  let secretsAvailable = false;

  for (const section of sections) {
    const routes = new Set([...Object.keys(section.user), ...Object.keys(section.value)]);
    for (const route of routes) {
      const declared = isPlainObject(section.user[route]) ? section.user[route] : {};
      const effective = isPlainObject(section.value[route]) ? section.value[route] : {};
      const meta = directory.get(route);

      if (isExpression(declared) || isExpression(effective)) {
        skipped.push({ id: route, reason: 'config holds a !!js expression, which cannot be exported', displayName: route });
        continue;
      }
      if (Object.keys(declared).length === 0) {
        skipped.push({
          id: route,
          reason: 'not configured in the profile patch (inherited from another layer)',
          displayName: typeof effective.displayName === 'string' ? effective.displayName : route,
        });
        continue;
      }
      if (typeof meta?.error === 'string' && meta.error !== '') {
        skipped.push({ id: route, reason: meta.error, displayName: String(meta.displayName ?? route) });
        continue;
      }

      const clean = pick(declared, PROVIDER_KEYS);
      const declaredModels = normalizeModels(clean.models, 'declared');
      const catalogModels = normalizeModels(mergeConfig(effective, {}).models, 'catalog');
      /* A route the user declared models for exports those; otherwise the whole
         model list stays the target catalog's job and nothing is pinned. */
      const models = declaredModels.length > 0 ? declaredModels : catalogModels;
      const inheritsModels = declaredModels.length === 0;

      const apiKeyEnv = typeof clean.apiKeyEnv === 'string' ? clean.apiKeyEnv : '';
      const credential = apiKeyEnv === '' ? { configured: false } : await readCredential(credentials, apiKeyEnv);
      if (credential.configured) {
        secretsAvailable = true;
        if (options.withSecrets === true && typeof credential.value === 'string') secrets[apiKeyEnv] = credential.value;
      }

      const { models: _ignored, ...profileRest } = clean;
      providers.set(route, {
        id: route,
        settingsNs: section.ns,
        displayName: typeof clean.displayName === 'string' ? clean.displayName
          : typeof effective.displayName === 'string' ? effective.displayName
            : typeof meta?.displayName === 'string' ? meta.displayName : route,
        api: typeof clean.api === 'string' ? clean.api : '',
        baseURL: typeof clean.baseURL === 'string' ? clean.baseURL : '',
        apiKeyEnv,
        apiKeyEnvEffective: typeof effective.apiKeyEnv === 'string' ? effective.apiKeyEnv : apiKeyEnv,
        defaultBaseURL: typeof meta?.defaultBaseURL === 'string' ? meta.defaultBaseURL : '',
        nativeAuthEnv: Array.isArray(meta?.nativeAuth?.env) ? meta.nativeAuth.env.map(String) : [],
        handDeclared: meta?.declared === true,
        hasCredential: credential.configured,
        inheritsModels,
        profile: profileRest,
        models,
      });
    }
  }

  /* Dormant catalog routes are not a rejection: they are simply not configured
     here, and listing forty of them beside a real problem would bury it. */
  const dormant = [];
  for (const entry of directory.values()) {
    if (providers.has(entry.provider)) continue;
    if (skipped.some((row) => row.id === entry.provider)) continue;
    dormant.push({
      id: entry.provider,
      displayName: typeof entry.displayName === 'string' ? entry.displayName : entry.provider,
    });
  }

  const view = [...providers.values()].map((provider) => ({
    id: provider.id,
    displayName: provider.displayName,
    api: provider.api,
    baseURL: provider.baseURL,
    apiKeyEnv: provider.apiKeyEnv,
    defaultBaseURL: provider.defaultBaseURL,
    nativeAuthEnv: provider.nativeAuthEnv,
    handDeclared: provider.handDeclared,
    hasCredential: provider.hasCredential,
    inheritsModels: provider.inheritsModels,
    models: provider.models.map((model) => ({
      id: model.id,
      origin: model.origin,
      name: typeof model.fields.name === 'string' ? model.fields.name : '',
      contextWindow: typeof model.fields.contextWindow === 'number' ? model.fields.contextWindow : null,
      maxTokens: typeof model.fields.maxTokens === 'number' ? model.fields.maxTokens : null,
      input: Array.isArray(model.fields.input) ? model.fields.input : [],
    })),
  }));

  return { providers, view, skipped, dormant, sources, secrets, secretsAvailable, warnings };
}

/**
 * What this profile already owns, in the shape the naming policy reads.
 * Conflict detection uses the effective layer, because that is what would clash
 * at import time.
 * @param {Map<string, any>} providers
 * @returns {Map<string, { facts: Record<string, string>, models: Map<string, unknown> }>}
 */
export function targetOf(providers) {
  /** @type {Map<string, { facts: Record<string, string>, models: Map<string, unknown> }>} */
  const target = new Map();
  for (const provider of providers.values()) {
    /** @type {Record<string, string>} */
    const facts = {};
    if (provider.apiKeyEnvEffective) facts.apiKeyEnv = provider.apiKeyEnvEffective;
    if (provider.api) facts.api = provider.api;
    if (provider.baseURL) facts.baseURL = provider.baseURL;
    const models = new Map();
    for (const model of provider.models) {
      if (model.origin === 'declared') models.set(model.id, { id: model.id, ...model.fields });
    }
    target.set(provider.id, { facts, models });
  }
  return target;
}

/**
 * @param {unknown} error
 * @returns {string}
 */
function messageOf(error) {
  if (error === null || error === undefined) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  return String(error);
}

export default { readCatalog, targetOf, plain, mergeConfig, isExpression };
