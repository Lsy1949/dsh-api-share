/**
 * dsh-api-share — host half.
 *
 * Three rules matter more than any feature, because breaking them breaks the
 * whole app:
 *
 *   1. `apply()` never throws. A synchronous throw fails this loader entry and
 *      the boot audit turns it into "Failed to load plugins".
 *   2. No module-level `inject`. Declaring a service nobody provides leaves the
 *      entry PENDING and drags the plugin tree down with it; the export only
 *      needs `webServer`, and it asks for that late with `ctx.inject()`.
 *   3. No log noise. A working plugin says nothing; anything worth saying is
 *      said once, with what the reader can do about it.
 */
import { buildRoutes, ROUTE_PREFIX } from './routes.js';
import { messageOf } from './http.js';

const PACKAGE_ID = 'dsh-api-share';

/**
 * Read the mount row's `config` without trusting its shape.
 *
 * @param {unknown} config
 * @returns {{ enabled: boolean }}
 */
export function normalizeConfig(config) {
  if (config === null || config === undefined || typeof config !== 'object') return { enabled: true };
  const enabled = /** @type {{ enabled?: unknown }} */ (config).enabled;
  return { enabled: enabled === undefined ? true : enabled !== false };
}

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {unknown} [config]
 */
export function apply(ctx, config) {
  try {
    const mountConfig = normalizeConfig(config);
    if (!mountConfig.enabled) return;

    /** @type {string[]} */
    const warnings = [];
    const report = (error) => {
      try {
        const text = messageOf(error);
        /* One line per distinct failure: a broken request must not flood a log. */
        if (text !== '' && !warnings.includes(text)) {
          warnings.push(text);
          console.warn(`[${PACKAGE_ID}] request failed: ${text}`);
        }
      } catch {
        /* reporting must never throw either */
      }
    };

    ctx.inject(['webServer'], (scoped) => {
      try {
        const server = scoped.webServer;
        if (server === undefined || typeof server.register !== 'function') return;
        for (const [path, handler] of buildRoutes(ctx, report)) {
          scoped.effect(() => server.register({ kind: 'exact', path, handler }), `${PACKAGE_ID}: ${path}`);
        }
      } catch (error) {
        report(error);
      }
    });
  } catch (error) {
    /* apply() must not throw, whatever happens */
    try {
      console.warn(`[${PACKAGE_ID}] not started: ${messageOf(error)}`);
    } catch {
      /* nothing left to do */
    }
  }
}

export default { name: PACKAGE_ID, apply };
export { ROUTE_PREFIX, PACKAGE_ID };
