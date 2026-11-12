/**
 * dsh-api-share — HTTP plumbing for the host half.
 *
 * Every route is a same-origin `POST` that answers JSON. Nothing here imports
 * `@deepseek-ai/*`: a third-party plugin cannot resolve the packages that live
 * inside `app.asar`, so request/response handling is plain `node:http`.
 */

/** Largest request body accepted; anything bigger is treated as malformed. */
const MAX_BODY_BYTES = 64 * 1024;

/**
 * Read and parse a JSON request body.
 *
 * @param {import('node:http').IncomingMessage} req
 * @returns {Promise<object | null>} parsed object, `{}` for an empty body, or
 *   `null` when the body is too large or not valid JSON.
 */
export async function readJsonBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) return null;
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Write one JSON response.
 *
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {unknown} value
 */
export function sendJson(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  res.end(body);
}

/**
 * Whether a request comes from another origin.
 *
 * The DSH GUI talks to its own host, so a browser `fetch` carries an `Origin`
 * header equal to `Host`. A request without `Origin` (curl, a local process)
 * is allowed: it cannot be a cross-site request from a page.
 *
 * @param {import('node:http').IncomingMessage} req
 * @returns {boolean}
 */
export function isCrossOrigin(req) {
  const headers = req?.headers;
  if (headers === undefined || headers === null) return false;
  const origin = headers.origin;
  if (typeof origin !== 'string' || origin === '') return false;
  const host = headers.host;
  if (typeof host !== 'string' || host === '') return true;
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

/**
 * Wrap a route handler with the rules every route shares: same-origin `POST`
 * only, and a JSON answer even when the handler throws.
 *
 * @param {(body: object, req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => Promise<void> | void} handler
 * @param {(error: unknown) => void} report
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => Promise<void>}
 */
export function postRoute(handler, report) {
  return async (req, res) => {
    if (isCrossOrigin(req)) {
      sendJson(res, 403, { ok: false, code: 'cross-origin' });
      return;
    }
    if (req.method !== 'POST') {
      res.setHeader('allow', 'POST');
      sendJson(res, 405, { ok: false, code: 'method-not-allowed' });
      return;
    }
    try {
      const body = await readJsonBody(req);
      if (body === null) {
        sendJson(res, 400, { ok: false, code: 'bad-body' });
        return;
      }
      await handler(body, req, res);
    } catch (error) {
      report(error);
      try {
        sendJson(res, 500, { ok: false, code: 'internal', detail: messageOf(error) });
      } catch {
        /* the response was already written */
      }
    }
  };
}

/**
 * @param {unknown} error
 * @returns {string}
 */
export function messageOf(error) {
  if (error === null || error === undefined) return '';
  if (typeof error === 'string') return error;
  if (typeof error.message === 'string') return error.message;
  try {
    return String(error);
  } catch {
    return '';
  }
}
