/**
 * dsh-api-share — writing provider configuration back into the profile.
 *
 * The only supported way for a plugin to change a plugin entry's configuration
 * is `configEditor.edit(entry, change)`. It takes the profile's file lock, reads
 * the patch document, validates the candidate through the plugin's own schema
 * (`fiber.resolveConfig`), writes atomically, reconciles the Loader, and rolls
 * the file back if the reload fails. That is exactly the guarantee an import
 * needs, so nothing here edits `cordis.patch.yml` by hand — a third-party plugin
 * has no YAML parser for it, no lock, and no business doing so.
 *
 * Everything is defensive: a missing service, a missing row, or a refused
 * candidate becomes a typed failure the route turns into a message, never into a
 * half-written profile.
 */

/** A failure a caller should surface verbatim. */
export class WriteError extends Error {
  /**
   * @param {string} message
   * @param {string} code
   */
  constructor(message, code) {
    super(message);
    this.name = 'WriteError';
    this.code = code;
  }
}

/** @param {unknown} value */
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** @param {unknown} error */
function messageOf(error) {
  if (error === null || error === undefined) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * The profile patch row that owns pi-ai providers.
 *
 * `override` is the row's `config:` block — the text the user wrote — while the
 * Loader entry is handed to `edit()` as the identity of the row to change.
 *
 * @param {any} ctx cordis host context
 * @param {string} [namespace] the settings namespace the catalogue reported
 * @returns {{ ns: string, entry: any, providers: Record<string, unknown> } | null}
 */
export function readProviderRow(ctx, namespace) {
  let editor;
  try {
    editor = typeof ctx?.get === 'function' ? ctx.get('configEditor') : undefined;
  } catch {
    return null;
  }
  if (editor === null || editor === undefined || typeof editor.configuration !== 'function') return null;

  let rows;
  try {
    rows = editor.configuration();
  } catch {
    return null;
  }
  if (!Array.isArray(rows)) return null;

  for (const row of rows) {
    const entry = row?.entry;
    const ns = typeof entry?.options?.id === 'string' ? entry.options.id : '';
    const name = typeof entry?.options?.name === 'string' ? entry.options.name : '';
    if (ns === '') continue;
    const isPiAi = name === '@deepseek-ai/dsh-llm-pi-ai' || name.endsWith('/dsh-llm-pi-ai');
    if (!isPiAi) continue;
    if (typeof namespace === 'string' && namespace !== '' && ns !== namespace) continue;
    const override = isPlainObject(row.override) ? row.override : {};
    const providers = isPlainObject(override.providers) ? override.providers : {};
    return { ns, entry, providers };
  }
  return null;
}

/**
 * Whether this composition can be written to at all.
 * @param {any} ctx cordis host context
 * @returns {boolean}
 */
export function canWrite(ctx) {
  try {
    const editor = typeof ctx?.get === 'function' ? ctx.get('configEditor') : undefined;
    if (editor === null || editor === undefined || typeof editor.edit !== 'function') return false;
    return readProviderRow(ctx) !== null;
  } catch {
    return false;
  }
}

/**
 * Ask the target plugin to validate a candidate configuration without writing it.
 *
 * `fiber.resolveConfig()` runs exactly the schema gate `edit()` will run, and it
 * publishes nothing, so the dialog can refuse a bad import before taking the
 * profile's lock.
 *
 * @param {any} ctx cordis host context
 * @param {Record<string, unknown>} nextProviders
 * @param {string} [namespace]
 * @returns {{ checked: boolean, error: string }}
 */
export function validateProviders(ctx, nextProviders, namespace) {
  const row = readProviderRow(ctx, namespace);
  const fiber = row?.entry?.fiber;
  if (row === null || fiber === null || fiber === undefined || typeof fiber.resolveConfig !== 'function') {
    return { checked: false, error: '' };
  }
  const base = isPlainObject(row.entry.options.config) ? row.entry.options.config : {};
  try {
    fiber.resolveConfig({ ...base, providers: nextProviders });
    return { checked: true, error: '' };
  } catch (error) {
    return { checked: true, error: messageOf(error) };
  }
}

/**
 * Confirm a write landed and that the adapter actually serves the new routes.
 *
 * The second half matters: pi-ai logs a route collision instead of failing, so a
 * provider whose name another adapter already serves would be written and then
 * silently ignored. Reporting that is the difference between "imported" and
 * "imported but not serving".
 *
 * @param {any} ctx cordis host context
 * @param {Record<string, unknown>} nextProviders
 * @param {string[]} routes ids the import created or renamed
 * @param {string} [namespace]
 * @returns {{ written: boolean, served: string[], missing: string[], warnings: string[] }}
 */
export function verifyProviders(ctx, nextProviders, routes, namespace) {
  /** @type {string[]} */
  const warnings = [];
  const row = readProviderRow(ctx, namespace);
  const written = row !== null;

  /** @type {Set<string>} */
  let served = new Set();
  try {
    const llm = typeof ctx?.get === 'function' ? ctx.get('llm') : undefined;
    if (llm !== undefined && llm !== null && typeof llm.listProviders === 'function') {
      for (const provider of llm.listProviders() ?? []) {
        if (typeof provider?.id === 'string') served.add(provider.id);
      }
    }
  } catch {
    /* the registry is optional: without it we simply cannot verify */
  }

  /** @type {string[]} */
  const missing = [];
  if (served.size > 0) {
    for (const route of routes) {
      if (!served.has(route)) missing.push(route);
    }
    if (missing.length > 0) {
      warnings.push(
        `${missing.join(', ')}: 已写入配置，但适配器没有提供服务 —— 通常说明该 provider 名被另一个适配器占用，或端点无法解析`,
      );
    }
  }
  return { written, served: [...served], missing, warnings };
}

/**
 * Replace the whole `providers` dictionary of the pi-ai row.
 *
 * All-or-nothing: the candidate is validated through the plugin's own schema
 * before anything is written, and a failed reload restores the previous file.
 *
 * @param {any} ctx cordis host context
 * @param {Record<string, unknown>} nextProviders the complete providers dictionary
 * @param {string} [namespace]
 * @param {{ routes?: string[] }} [options] ids to confirm are served afterwards
 * @returns {Promise<{ ns: string, warnings: string[], served: string[], missing: string[] }>}
 */
export async function writeProviders(ctx, nextProviders, namespace, options = {}) {
  if (!isPlainObject(nextProviders)) throw new WriteError('the provider dictionary must be an object', 'invalid-providers');

  const editor = typeof ctx?.get === 'function' ? ctx.get('configEditor') : undefined;
  if (editor === null || editor === undefined || typeof editor.edit !== 'function') {
    throw new WriteError('this composition has no configEditor service, so a plugin cannot write configuration', 'write-unavailable');
  }

  const row = readProviderRow(ctx, namespace);
  if (row === null) {
    throw new WriteError('the llm-pi-ai configuration row could not be located in this profile', 'row-missing');
  }

  /* Validate first: a bad candidate should fail fast, with the adapter's own
     wording, without waiting for the file lock. */
  const precheck = validateProviders(ctx, nextProviders, namespace);
  if (precheck.checked && precheck.error !== '') {
    throw new WriteError(precheck.error, 'invalid-config');
  }

  try {
    await editor.edit(row.entry, (current) => {
      /* Keep everything else the row declares (retry policies, headers, …) and
         replace only the provider dictionary the import owns. */
      const base = isPlainObject(current) ? current : {};
      return { ...base, providers: nextProviders };
    });
  } catch (error) {
    const text = messageOf(error);
    if (/no longer available|changed during reload|no longer active/.test(text)) {
      throw new WriteError(`the configuration changed while importing (${text}); reopen the dialog and try again`, 'stale-entry');
    }
    if (/overridden by a home patch|command-line overlay/.test(text)) {
      throw new WriteError(`${text}`, 'overridden');
    }
    throw new WriteError(text === '' ? 'the configuration write was refused' : text, 'refused');
  }

  const verified = verifyProviders(ctx, nextProviders, options.routes ?? [], namespace);
  return { ns: row.ns, warnings: verified.warnings, served: verified.served, missing: verified.missing };
}

export default { readProviderRow, writeProviders, validateProviders, verifyProviders, canWrite, WriteError };
