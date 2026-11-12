/**
 * dsh-api-share — adaptive naming for exported entries.
 *
 * `${route}` and `${model}` ids are the keys every other namespace, saved
 * session and credential reference uses, so an export that lands on names the
 * receiving side already owns must not silently overwrite them. This module is
 * the whole policy, kept pure so it is testable without a running harness:
 *
 *   - An id nobody owns keeps itself.
 *   - An id owned by an entry with the same *connection facts* (protocol,
 *     endpoint, credential reference, display name) is the same provider and
 *     keeps its id — re-importing your own provider is not a conflict.
 *   - An id owned by a *different* provider is renamed with the first free
 *     numeric suffix (`foo` -> `foo-2` -> `foo-3`) and the rename is reported,
 *     so the UI can show exactly what changed.
 *   - A model id is compared inside its provider: same id with a different
 *     payload is renamed, an absent model is simply added, and an identical
 *     model is left alone. A renamed provider is a brand-new route, so its
 *     models are never renamed.
 */

/**
 * @typedef {{ api?: string, baseURL?: string, apiKeyEnv?: string }} ProviderFacts
 * @typedef {{ id: string, facts: ProviderFacts, models: Array<{ id: string, payload: unknown }> }} SelectedProvider
 * @typedef {{ facts: ProviderFacts, models: Map<string, unknown> }} ExistingProvider
 * @typedef {{ kind: 'provider' | 'model', provider: string, from: string, to: string, reason: string }} Rename
 */

/**
 * Fields that decide whether two entries are the same provider. A display name
 * is a label a profile may or may not declare, so it never makes two routes
 * "different" — and neither does anything the target simply did not write.
 */
const FACT_KEYS = ['api', 'baseURL', 'apiKeyEnv'];

/**
 * Deterministic JSON with sorted keys, for payload comparison only.
 * @param {unknown} value
 * @returns {string}
 */
export function stableKey(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableKey).join(',')}]`;
  const record = /** @type {Record<string, unknown>} */ (value);
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableKey(record[key])}`).join(',')}}`;
}

/**
 * Compare two providers by their connection facts only.
 * @param {ProviderFacts} left
 * @param {ProviderFacts} right
 * @returns {boolean}
 */
export function sameFacts(left, right) {
  for (const key of FACT_KEYS) {
    const a = left[key];
    const b = right[key];
    const leftEmpty = a === undefined || a === null || a === '';
    const rightEmpty = b === undefined || b === null || b === '';
    if (leftEmpty && rightEmpty) continue;
    if (a !== b) return false;
  }
  return true;
}

/**
 * Pick the first free suffix for `base` that is not in `taken`.
 * @param {string} base
 * @param {Set<string>} taken
 * @returns {string}
 */
export function freeName(base, taken) {
  if (!taken.has(base)) return base;
  for (let index = 2; index < 10_000; index += 1) {
    const candidate = `${base}-${index}`;
    if (!taken.has(candidate)) return candidate;
  }
  /* Unreachable in practice; still better than returning a duplicate. */
  return `${base}-copy`;
}

/**
 * Pick a name for `base` that always carries a numeric suffix.
 * @param {string} base
 * @param {Set<string>} taken
 * @returns {string}
 */
export function forcedSuffix(base, taken) {
  for (let index = 2; index < 10_000; index += 1) {
    const candidate = `${base}-${index}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-copy`;
}

/**
 * Rename exported entries that would collide with what the receiving side owns.
 *
 * @param {object} input
 * @param {SelectedProvider[]} input.providers the selection, reduced to what the export writes
 * @param {Map<string, ExistingProvider>} [input.target] what the receiving side already owns
 * @param {{ mode?: 'auto' | 'always' | 'off' }} [input.options]
 *   `auto` (default) renames only real conflicts, `always` suffixes every provider
 *   id so the snippet can be merged into a profile that already has these routes,
 *   `off` keeps every name exactly as typed
 * @returns {{ providers: SelectedProvider[], renames: Rename[], identical: string[] }}
 */
export function resolveNames(input) {
  const mode = input.options?.mode === 'always' ? 'always' : input.options?.mode === 'off' ? 'off' : 'auto';
  const target = input.target ?? new Map();
  /** @type {Rename[]} */
  const renames = [];
  /** @type {string[]} */
  const identical = [];

  if (mode === 'off') {
    return { providers: detach(input.providers), renames, identical };
  }

  const takenProviders = new Set(target.keys());
  /** @type {SelectedProvider[]} */
  const providers = [];

  for (const provider of input.providers) {
    const existing = target.get(provider.id);
    const sameProvider = existing !== undefined && sameFacts(existing.facts, provider.facts);
    let id = provider.id;

    if (mode === 'always') {
      id = forcedSuffix(provider.id, takenProviders);
      renames.push({
        kind: 'provider',
        provider: provider.id,
        from: provider.id,
        to: id,
        reason: 'every id is suffixed on request, so the snippet can sit beside the routes it was exported from',
      });
    } else if (existing !== undefined) {
      if (sameProvider) identical.push(provider.id);
      else {
        id = freeName(provider.id, takenProviders);
        renames.push({
          kind: 'provider',
          provider: provider.id,
          from: provider.id,
          to: id,
          reason: 'receiving side already has a provider with this id and a different connection',
        });
      }
    }
    takenProviders.add(id);

    const keptProvider = id === provider.id && existing !== undefined;
    const takenModels = new Set(keptProvider ? existing.models.keys() : []);
    const models = [];
    for (const model of provider.models) {
      let modelId = model.id;
      if (keptProvider && existing.models.has(model.id)) {
        const known = existing.models.get(model.id);
        if (stableKey(known) !== stableKey(model.payload)) {
          modelId = freeName(model.id, takenModels);
          renames.push({
            kind: 'model',
            provider: id,
            from: model.id,
            to: modelId,
            reason: 'this provider already serves a different model with this id',
          });
        }
      }
      takenModels.add(modelId);
      models.push({ id: modelId, payload: model.payload });
    }

    providers.push({ id, facts: { ...provider.facts }, models });
  }

  return { providers, renames, identical };
}

/**
 * Deep copy of a selection, so a disabled resolver still returns detached data.
 * @param {SelectedProvider[]} providers
 * @returns {SelectedProvider[]}
 */
function detach(providers) {
  return providers.map((provider) => ({
    id: provider.id,
    facts: { ...provider.facts },
    models: provider.models.map((model) => ({ id: model.id, payload: model.payload })),
  }));
}

export default { resolveNames, freeName, stableKey, sameFacts };
