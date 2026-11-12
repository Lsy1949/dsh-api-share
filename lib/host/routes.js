/**
 * dsh-api-share — the host route table.
 *
 * Four same-origin `POST` routes, all answering JSON:
 *
 *   POST <prefix>/catalog          what this profile can export (providers + models)
 *   POST <prefix>/export           { selection, mode, includeSecrets } -> YAML + JSON
 *   POST <prefix>/import/preview   { text, policy } -> the plan an import would apply
 *   POST <prefix>/import/apply     { text, policy, confirm } -> writes providers
 *
 * The client half is the only caller; nothing is reachable from another origin.
 * Only the last route writes, and it writes through `configEditor.edit()` — the
 * one path that validates, locks, and rolls back.
 */
import { readCatalog, targetOf } from './catalog.js';
import { buildExport } from './export.js';
import { parseSnippet, planImport, planChanges, IMPORT_POLICIES } from './importer.js';
import { canWrite, readProviderRow, writeProviders, validateProviders, WriteError } from './write.js';
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
 * Validate one import request.
 * @param {unknown} raw
 * @returns {{ text: string, policy: 'merge' | 'skip' | 'overwrite', confirm: boolean }}
 */
export function normalizeImportRequest(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('body must be an object');
  const body = /** @type {Record<string, unknown>} */ (raw);
  if (typeof body.text !== 'string') throw new Error('text must be the pasted snippet');
  const policy = IMPORT_POLICIES.includes(/** @type {any} */ (body.policy)) ? /** @type {any} */ (body.policy) : 'merge';
  return { text: body.text, policy, confirm: body.confirm === true };
}

/**
 * Plan one import against the providers this profile actually stores.
 *
 * The raw row value is preferred over the catalogue's sanitised copy: a plan
 * built on the sanitised dictionary would drop fields the adapter keeps but this
 * plugin does not model, and the write would then silently lose them.
 *
 * @param {any} ctx
 * @param {{ text: string, policy: 'merge' | 'skip' | 'overwrite' }} request
 * @returns {Promise<{ row: any, parsed: any, plan: any }>}
 */
async function planRequest(ctx, request) {
  const parsed = parseSnippet(request.text);
  const row = readProviderRow(ctx);
  let current = row === null ? null : row.providers;
  if (current === null) {
    /* No writable row (or no configEditor): plan against what the catalogue
       reads, so a read-only composition can still preview a plan. */
    const catalog = await readCatalog(ctx);
    current = {};
    for (const provider of catalog.providers.values()) {
      const declared = /** @type {Record<string, unknown>} */ ({ ...provider.profile });
      if (provider.models.length > 0) {
        declared.models = provider.models.map((model) => ({ id: model.id, ...(model.fields ?? {}) }));
      }
      current[provider.id] = declared;
    }
  }
  const plan = planImport({ rows: parsed.rows, current, policy: request.policy });
  return { row, parsed, plan };
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
        canWrite: canWrite(ctx),
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

  routes.set(
    `${ROUTE_PREFIX}/import/preview`,
    postRoute(async (body, _req, res) => {
      let request;
      try {
        request = normalizeImportRequest(body);
      } catch (error) {
        sendJson(res, 400, { ok: false, code: 'bad-body', detail: error instanceof Error ? error.message : String(error) });
        return;
      }
      try {
        const { parsed, plan } = await planRequest(ctx, request);
        const validation = validateProviders(ctx, plan.next);
        sendJson(res, 200, {
          ok: true,
          generatedAt: new Date().toISOString(),
          format: parsed.format,
          policy: plan.policy,
          entries: plan.entries,
          summary: plan.summary,
          warnings: plan.warnings,
          canWrite: canWrite(ctx),
          changes: planChanges(plan),
          /* The adapter's own gate, run without publishing anything: a plan that
             would be refused says so before the user presses write. */
          validation: { checked: validation.checked, error: validation.error },
        });
      } catch (error) {
        sendJson(res, 422, { ok: false, code: 'bad-snippet', detail: error instanceof Error ? error.message : String(error) });
      }
    }, report),
  );

  routes.set(
    `${ROUTE_PREFIX}/import/apply`,
    postRoute(async (body, _req, res) => {
      let request;
      try {
        request = normalizeImportRequest(body);
      } catch (error) {
        sendJson(res, 400, { ok: false, code: 'bad-body', detail: error instanceof Error ? error.message : String(error) });
        return;
      }
      if (!request.confirm) {
        sendJson(res, 400, { ok: false, code: 'not-confirmed', detail: 'the request must carry confirm: true' });
        return;
      }
      if (!canWrite(ctx)) {
        sendJson(res, 409, {
          ok: false,
          code: 'write-unavailable',
          detail: 'this composition has no writable llm-pi-ai configuration row',
        });
        return;
      }

      let plan;
      try {
        const planned = await planRequest(ctx, request);
        plan = planned.plan;
      } catch (error) {
        sendJson(res, 422, { ok: false, code: 'bad-snippet', detail: error instanceof Error ? error.message : String(error) });
        return;
      }

      if (!planChanges(plan)) {
        sendJson(res, 200, {
          ok: true,
          applied: false,
          generatedAt: new Date().toISOString(),
          policy: plan.policy,
          entries: plan.entries,
          summary: plan.summary,
          warnings: plan.warnings,
        });
        return;
      }

      try {
        /* Every route the import creates or renames must end up served; the
           adapter logs a collision instead of failing, so verify afterwards. */
        const routes = plan.entries
          .filter((entry) => entry.action === 'create' || entry.action === 'rename')
          .map((entry) => entry.to);
        const written = await writeProviders(ctx, plan.next, undefined, { routes });
        sendJson(res, 200, {
          ok: true,
          applied: true,
          generatedAt: new Date().toISOString(),
          namespace: written.ns,
          policy: plan.policy,
          entries: plan.entries,
          summary: plan.summary,
          warnings: [...plan.warnings, ...written.warnings],
          served: written.served,
          unserved: written.missing,
        });
      } catch (error) {
        const code = error instanceof WriteError ? error.code : 'write-failed';
        const detail = error instanceof Error ? error.message : String(error);
        sendJson(res, code === 'write-unavailable' ? 409 : 422, { ok: false, code, detail });
      }
    }, report),
  );

  return routes;
}

export default { buildRoutes, normalizeRequest, normalizeImportRequest, isBrowserSameOrigin, ROUTE_PREFIX };
