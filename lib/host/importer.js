/**
 * dsh-api-share — importing a snippet back into a profile.
 *
 * The import half turns text (the JSON document this plugin writes, or the YAML
 * snippet it writes) into a *plan*: which providers are new, which are identical,
 * which collide and how the collision is resolved. Nothing here touches the
 * harness — the route applies the plan — so the whole policy is testable and the
 * dialog can preview exactly what would happen.
 *
 * Import policies, chosen by the user:
 *   merge     (default) create new providers, and give a colliding provider a
 *             free numeric suffix instead of touching what the profile already has
 *   skip      create new providers, leave colliding ones exactly as they are
 *   overwrite replace a colliding provider wholesale (the snippet wins)
 */
import { stableKey } from './naming.js';
import { parseYaml, YamlError } from './yaml-parse.js';

/** Policies the UI offers, in the order it shows them. */
export const IMPORT_POLICIES = ['merge', 'skip', 'overwrite'];

/** Provider fields `llm-pi-ai` accepts; anything else is dropped on import. */
const PROVIDER_KEYS = new Set([
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
]);

/** Model fields `llm-pi-ai` accepts. */
const MODEL_KEYS = new Set(['id', 'name', 'contextWindow', 'maxTokens', 'input', 'reasoningEfforts', 'compat']);

/** Largest snippet accepted, so a pasted log cannot stall the host. */
export const MAX_SNIPPET_BYTES = 512 * 1024;

/** @param {unknown} value */
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** @param {unknown} value */
function isExpression(value) {
  return isPlainObject(value) && Object.prototype.hasOwnProperty.call(value, '__jsExpr');
}

/**
 * Read the incoming text into patch rows.
 *
 * @param {string} text
 * @returns {{ rows: Array<{ id: string, name: string, providers: Record<string, unknown> }>, format: 'json' | 'yaml', warnings: string[] }}
 */
export function parseSnippet(text) {
  if (typeof text !== 'string') throw new Error('the snippet must be text');
  const trimmed = text.trim();
  if (trimmed === '') throw new Error('the snippet is empty');
  if (Buffer.byteLength(trimmed, 'utf8') > MAX_SNIPPET_BYTES) {
    throw new Error(`the snippet is larger than ${Math.round(MAX_SNIPPET_BYTES / 1024)} KiB`);
  }

  /** @type {{ format: 'json' | 'yaml', value: unknown }} */
  let parsed;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    let value;
    try {
      value = JSON.parse(trimmed);
    } catch (error) {
      throw new Error(`this is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
    parsed = { format: 'json', value };
  } else {
    try {
      parsed = { format: 'yaml', value: parseYaml(trimmed) };
    } catch (error) {
      if (error instanceof YamlError) throw new Error(`this YAML could not be read: ${error.message}`);
      throw error;
    }
  }

  const rows = collectRows(parsed.value);
  if (rows.length === 0) {
    throw new Error('no provider configuration found: expected an llm-pi-ai row with a providers dictionary');
  }
  return { rows, format: parsed.format, warnings: [] };
}

/**
 * Find the patch rows that carry providers, in any of the shapes we accept:
 * the JSON document (`{ patch: [...] }`), a bare patch array, or a single row.
 *
 * @param {unknown} value
 * @returns {Array<{ id: string, name: string, providers: Record<string, unknown> }>}
 */
function collectRows(value) {
  /** @type {unknown[]} */
  let candidates = [];
  if (Array.isArray(value)) candidates = value;
  else if (isPlainObject(value) && Array.isArray(value.patch)) candidates = value.patch;
  else if (isPlainObject(value)) candidates = [value];

  /** @type {Array<{ id: string, name: string, providers: Record<string, unknown> }>} */
  const rows = [];
  for (const candidate of candidates) {
    if (!isPlainObject(candidate)) continue;
    const config = isPlainObject(candidate.config) ? candidate.config : undefined;
    if (config === undefined || !isPlainObject(config.providers)) continue;
    /* The row must be the pi-ai adapter's: exporting under another plugin's id
       would write providers into a schema that never reads them. */
    const name = typeof candidate.name === 'string' ? candidate.name : '';
    const id = typeof candidate.id === 'string' ? candidate.id : '';
    if (name !== '@deepseek-ai/dsh-llm-pi-ai' && !name.endsWith('/dsh-llm-pi-ai')) {
      if (name !== '') continue;
    }
    rows.push({ id, name, providers: config.providers });
  }
  return rows;
}

/**
 * Remove `!!js` expressions at any depth.
 *
 * This is a security boundary, not tidiness: `configEditor.edit()` turns a
 * single-key `{ __jsExpr }` mapping back into a `!!js` YAML node, and the Loader
 * *evaluates* that node. A pasted snippet must therefore never carry one into the
 * profile — so every value, at every depth, is scanned and any expression is
 * dropped with a warning naming its path.
 *
 * @param {unknown} value
 * @param {string} trail
 * @param {string[]} warnings
 * @returns {unknown}
 */
function stripExpressions(value, trail, warnings) {
  if (isExpression(value)) {
    warnings.push(`${trail}: dropped a !!js expression, which would execute as code`);
    return undefined;
  }
  if (Array.isArray(value)) {
    const out = [];
    value.forEach((item, index) => {
      const next = stripExpressions(item, `${trail}[${index}]`, warnings);
      if (next !== undefined) out.push(next);
    });
    return out;
  }
  if (isPlainObject(value)) {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      const next = stripExpressions(item, `${trail}.${key}`, warnings);
      if (next !== undefined) out[key] = next;
    }
    return out;
  }
  return value;
}

/**
 * Keep only the fields the adapter accepts, dropping `!!js` expressions.
 *
 * @param {Record<string, unknown>} profile
 * @param {string} route
 * @param {string[]} warnings
 * @returns {Record<string, unknown>}
 */
function sanitizeProfile(profile, route, warnings) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, value] of Object.entries(profile)) {
    if (!PROVIDER_KEYS.has(key)) {
      warnings.push(`${route}: dropped field "${key}", which llm-pi-ai does not accept`);
      continue;
    }
    if (key === 'models') continue; /* handled below, in order */
    const clean = stripExpressions(value, `${route}.${key}`, warnings);
    if (clean !== undefined) out[key] = clean;
  }

  if (Array.isArray(profile.models)) {
    /** @type {unknown[]} */
    const models = [];
    const seen = new Set();
    for (const model of profile.models) {
      if (!isPlainObject(model) || typeof model.id !== 'string' || model.id.trim() === '') {
        warnings.push(`${route}: dropped a model entry without an id`);
        continue;
      }
      const id = model.id.trim();
      if (seen.has(id)) {
        warnings.push(`${route}: dropped duplicate model "${id}"`);
        continue;
      }
      seen.add(id);
      /** @type {Record<string, unknown>} */
      const clean = { id };
      for (const [key, value] of Object.entries(model)) {
        if (key === 'id') continue;
        if (!MODEL_KEYS.has(key)) {
          warnings.push(`${route}/${id}: dropped field "${key}", which llm-pi-ai does not accept`);
          continue;
        }
        const cleaned = stripExpressions(value, `${route}/${id}.${key}`, warnings);
        if (cleaned !== undefined) clean[key] = cleaned;
      }
      models.push(clean);
    }
    out.models = models;
  }

  return out;
}

/**
 * Turn rows into a plan against the profile's current providers.
 *
 * @param {object} input
 * @param {Array<{ id: string, providers: Record<string, unknown> }>} input.rows
 * @param {Record<string, Record<string, unknown>>} input.current the profile's current `providers` dict
 * @param {'merge' | 'skip' | 'overwrite'} [input.policy]
 * @returns {{
 *   policy: 'merge' | 'skip' | 'overwrite',
 *   entries: Array<{
 *     provider: string,
 *     action: 'create' | 'rename' | 'update' | 'unchanged' | 'skip' | 'invalid',
 *     to: string,
 *     from: string,
 *     models: { total: number, added: number, kept: number },
 *     reason: string,
 *   }>,
 *   next: Record<string, Record<string, unknown>>,
 *   warnings: string[],
 *   summary: { create: number, rename: number, update: number, unchanged: number, skip: number, invalid: number },
 * }}
 */
export function planImport(input) {
  const policy = IMPORT_POLICIES.includes(input.policy ?? '') ? /** @type {any} */ (input.policy) : 'merge';
  const current = isPlainObject(input.current) ? input.current : {};
  /** @type {string[]} */
  const warnings = [];
  /** @type {any[]} */
  const entries = [];
  /** @type {Record<string, Record<string, unknown>>} */
  const next = { ...current };
  const taken = new Set(Object.keys(current));
  const summary = { create: 0, rename: 0, update: 0, unchanged: 0, skip: 0, invalid: 0 };

  for (const row of input.rows) {
    for (const [rawRoute, rawProfile] of Object.entries(row.providers)) {
      const route = rawRoute.trim();
      if (route === '') {
        warnings.push('skipped a provider with an empty id');
        summary.invalid += 1;
        entries.push({ provider: '(empty)', action: 'invalid', to: '', from: '', models: { total: 0, added: 0, kept: 0 }, reason: 'the provider id is empty' });
        continue;
      }
      if (!isPlainObject(rawProfile) || isExpression(rawProfile)) {
        warnings.push(`${route}: skipped, the profile is not a plain mapping`);
        summary.invalid += 1;
        entries.push({ provider: route, action: 'invalid', to: '', from: route, models: { total: 0, added: 0, kept: 0 }, reason: 'the provider profile is not a plain mapping' });
        continue;
      }

      const incoming = sanitizeProfile(rawProfile, route, warnings);
      const existing = Object.prototype.hasOwnProperty.call(current, route) ? current[route] : undefined;
      const modelCount = Array.isArray(incoming.models) ? incoming.models.length : 0;

      if (existing === undefined) {
        /* A route the target catalog does not ship needs endpoint facts of its
           own; without them the write would be refused, so say so now. */
        const hasEndpoint = typeof incoming.api === 'string' && typeof incoming.baseURL === 'string' && modelCount > 0;
        const looksCatalogServed = !hasEndpoint;
        if (looksCatalogServed) {
          warnings.push(
            `${route}: 片段没有带 api / baseURL / models，导入后要求目标环境已有同名内置 provider，否则会被拒绝服务`,
          );
        }
        next[route] = incoming;
        taken.add(route);
        summary.create += 1;
        entries.push({ provider: route, action: 'create', to: route, from: route, models: { total: modelCount, added: modelCount, kept: 0 }, reason: 'new provider' });
        continue;
      }

      const identical = stableKey(existing) === stableKey(incoming);
      if (identical) {
        summary.unchanged += 1;
        entries.push({ provider: route, action: 'unchanged', to: route, from: route, models: { total: modelCount, added: 0, kept: modelCount }, reason: 'identical to what the profile already has' });
        continue;
      }

      if (policy === 'skip') {
        summary.skip += 1;
        entries.push({ provider: route, action: 'skip', to: route, from: route, models: { total: modelCount, added: 0, kept: 0 }, reason: 'the profile already has a different provider with this id' });
        continue;
      }

      if (policy === 'overwrite') {
        next[route] = incoming;
        summary.update += 1;
        entries.push({ provider: route, action: 'update', to: route, from: route, models: { total: modelCount, added: modelCount, kept: 0 }, reason: 'replaces the existing provider' });
        continue;
      }

      let free = '';
      for (let index = 2; index < 1000; index += 1) {
        const candidate = `${route}-${index}`;
        if (!taken.has(candidate)) {
          free = candidate;
          break;
        }
      }
      if (free === '') {
        warnings.push(`${route}: gave up looking for a free id`);
        summary.invalid += 1;
        entries.push({ provider: route, action: 'invalid', to: '', from: route, models: { total: modelCount, added: 0, kept: 0 }, reason: 'no free id' });
        continue;
      }
      next[free] = incoming;
      taken.add(free);
      summary.rename += 1;
      entries.push({ provider: route, action: 'rename', to: free, from: route, models: { total: modelCount, added: modelCount, kept: 0 }, reason: 'the profile already owns this id, so the import gets its own' });
    }
  }

  return { policy, entries, next, warnings, summary };
}

/**
 * Whether a plan would change anything.
 * @param {{ summary: { create: number, rename: number, update: number } }} plan
 * @returns {boolean}
 */
export function planChanges(plan) {
  return plan.summary.create + plan.summary.rename + plan.summary.update > 0;
}

export default { parseSnippet, planImport, planChanges, IMPORT_POLICIES, MAX_SNIPPET_BYTES };
