/**
 * dsh-api-share — the host route table.
 *
 * Two same-origin `POST` routes, both answering JSON:
 *
 *   POST <prefix>/catalog   what this profile can export (providers + models)
 *   POST <prefix>/export    { selection, rename, includeSecrets } -> YAML + JSON
 *
 * The client half is the only caller; nothing here is reachable from another
 * origin and nothing writes to disk, so a failed request cannot damage a profile.
 */
import { readCatalog, targetOf } from './catalog.js';
import { buildExport } from './export.js';
import { postRoute, sendJson } from './http.js';

export const ROUTE_PREFIX = '/dsh-api-share';

/** Rules for one export request; small on purpose, the UI offers no more. */
const MAX_PROVIDERS = 64;
const MAX_MODELS = 2048;

/**
 * Whether the request is a same-origin request made by the DSH page itself.
 *
 * The configuration export carries no secrets, so a local process may read it.
 * A *credential value* is different: it is only ever returned to the page that
 * asked from the same origin, never to an origin-less local caller.
 *
 * @param {import('node:http').IncomingMessage} req
 * @returns {boolean}
 */
export function isBrowserSameOrigin(req) {
  const headers = req?.headers ?? {};
  const origin = typeof headers.origin === 'string' ? headers.origin : '';
  const host = typeof headers.host === 'string' ? headers.host : '';
  if (origin === '' || host === '') return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * Validate the client's selection with the same strictness the UI applies, so a
 * malformed body is refused instead of half-exported.
 *
 * @param {unknown} raw
 * @returns {{ selection: Array<{ id: string, models: string[] }>, mode: 'auto' | 'always' | 'off', includeSecrets: boolean }}
 */
export function normalizeRequest(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('body must be an object');
  const body = /** @type {Record<string, unknown>} */ (raw);
  const rawSelection = body.selection;
  if (!Array.isArray(rawSelection) || rawSelection.length === 0) throw new Error('selection must be a non-empty array');
  if (rawSelection.length > MAX_PROVIDERS) throw new Error(`selection names more than ${MAX_PROVIDERS} providers`);

  /** @type {Array<{ id: string, models: string[] }>} */
  const selection = [];
  let total = 0;
  for (const entry of rawSelection) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('every selection entry must be an object');
    const row = /** @type {Record<string, unknown>} */ (entry);
    const id = row.id;
    if (typeof id !== 'string' || id.trim() === '') throw new Error('every selection entry needs a provider id');
    const models = row.models;
    if (!Array.isArray(models) || models.length === 0) throw new Error(`selection entry "${id}" needs at least one model`);
    /** @type {string[]} */
    const ids = [];
    for (const model of models) {
      if (typeof model !== 'string' || model.trim() === '') throw new Error(`selection entry "${id}" has a malformed model id`);
      if (ids.includes(model)) continue;
      ids.push(model);
    }
    total += ids.length;
    if (total > MAX_MODELS) throw new Error(`selection names more than ${MAX_MODELS} models`);
    selection.push({ id: id.trim(), models: ids });
  }

  return {
    selection,
    mode: body.mode === 'always' ? 'always' : body.mode === 'off' ? 'off' : 'auto',
    includeSecrets: body.includeSecrets === true,
  };
}

/**
 * Build the route table for one mount.
 *
 * @param {any} ctx cordis host context
 * @param {(error: unknown) => void} report
 * @returns {Map<string, (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => Promise<void>>}
 */
export function buildRoutes(ctx, report) {
  /** @type {Map<string, any>} */
  const routes = new Map();

  routes.set(
    `${ROUTE_PREFIX}/catalog`,
    postRoute(async (_body, _req, res) => {
      const catalog = await readCatalog(ctx);
      sendJson(res, 200, {
        ok: true,
        generatedAt: new Date().toISOString(),
        sources: catalog.sources,
        secretsAvailable: catalog.secretsAvailable,
        providers: catalog.view,
        skipped: catalog.skipped,
        dormant: catalog.dormant,
        warnings: catalog.warnings,
      });
    }, report),
  );

  routes.set(
    `${ROUTE_PREFIX}/export`,
    postRoute(async (body, req, res) => {
      const request = normalizeRequest(body);
      /* A credential value never leaves for an origin-less local caller. */
      const includeSecrets = request.includeSecrets && isBrowserSameOrigin(req);
      if (request.includeSecrets && !includeSecrets) {
        sendJson(res, 403, { ok: false, code: 'secrets-require-browser-origin' });
        return;
      }
      const catalog = await readCatalog(ctx, { withSecrets: includeSecrets });
      const result = buildExport({
        catalog: catalog.providers,
        target: targetOf(catalog.providers),
        selection: request.selection,
        options: {
          mode: request.mode,
          secretRequested: includeSecrets,
          secrets: includeSecrets ? catalog.secrets : null,
        },
      });
      sendJson(res, 200, {
        ok: true,
        generatedAt: new Date().toISOString(),
        mode: request.mode,
        yaml: result.yaml,
        json: result.json,
        renames: result.renames,
        identical: result.identical,
        warnings: [...catalog.warnings, ...result.warnings],
        providerIds: result.providerIds,
        secretsIncluded: includeSecrets && Object.keys(catalog.secrets).length > 0,
      });
    }, report),
  );

  return routes;
}

export default { buildRoutes, normalizeRequest, ROUTE_PREFIX };
