// @ts-check
/**
 * DEV ONLY: a tiny JSON API server (node:http, no dependencies).
 *
 * - routes live below `/api` (the apps' `settings.apiBaseUrl` is `http://localhost:<port>/api`)
 * - CORS like a real API on another origin with cookie sessions: the request's Origin is echoed
 *   for `http://localhost:*` / `http://127.0.0.1:*` only, with
 *   `Access-Control-Allow-Credentials: true`; preflight allows `Content-Type` and `X-CSRF-Token`
 * - `GET /api/health`; `POST /__reset` (also `/api/__reset`) restores the seed data (tests)
 * - optional latency (`delayMs`) to look at loading states
 */
import http from 'node:http';

/**
 * @typedef {{ status: number, body?: unknown }} ApiResult
 * @typedef {{
 *   params: Record<string, string>,
 *   query: URLSearchParams,
 *   body: unknown,
 *   headers: http.IncomingHttpHeaders,
 * }} ApiRequest
 * @typedef {{
 *   method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
 *   path: string,
 *   handler: (req: ApiRequest) => ApiResult,
 * }} Route
 * @typedef {{ routes: Route[], reset: () => void }} MockResource
 */

export const API_PREFIX = '/api';
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const MAX_BODY_BYTES = 64 * 1024;

/** @param {number} status @param {unknown} [body] @returns {ApiResult} */
export function json(status, body) {
  return { status, body };
}

/** @param {string} [message] @returns {ApiResult} */
export function notFound(message = 'Not found') {
  return json(404, { message });
}

/**
 * 422 with field errors, the shape the apps map onto their forms
 * (`HttpClientError.body.errors`).
 * @param {Record<string, string>} errors
 * @returns {ApiResult}
 */
export function validationError(errors) {
  return json(422, {
    message: 'Please correct the highlighted fields.',
    errors,
  });
}

/**
 * Match `/items/:id` against `/items/42`.
 * @param {string} pattern
 * @param {string} pathname
 * @returns {Record<string, string> | null}
 */
export function matchPath(pattern, pathname) {
  const want = pattern.split('/').filter(Boolean);
  const got = pathname.split('/').filter(Boolean);
  if (want.length !== got.length) return null;
  /** @type {Record<string, string>} */
  const params = {};
  for (let i = 0; i < want.length; i += 1) {
    if (want[i].startsWith(':'))
      params[want[i].slice(1)] = decodeURIComponent(got[i]);
    else if (want[i] !== got[i]) return null;
  }
  return params;
}

/** @param {http.IncomingMessage} req @returns {Promise<unknown>} */
async function readBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  let size = 0;
  /** @type {Buffer[]} */
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES)
      throw Object.assign(new Error('Body too large'), { status: 413 });
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    throw Object.assign(new Error('Body is not valid JSON'), { status: 400 });
  }
}

/**
 * @param {{ zone: string, resources: MockResource[], delayMs?: number, log?: boolean }} options
 */
export function createApiServer({ zone, resources, delayMs = 0, log = false }) {
  const routes = resources.flatMap((r) => r.routes);
  const reset = () => resources.forEach((r) => r.reset());

  return http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (origin && LOCAL_ORIGIN.test(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE',
        'Access-Control-Allow-Headers': 'Accept, Content-Type, X-CSRF-Token',
        'Access-Control-Max-Age': '600',
      });
      res.end();
      return;
    }

    /** @param {ApiResult} result */
    const send = (result) => {
      if (log) {
        console.log(
          `[mock-api ${zone}] ${req.method} ${req.url} → ${result.status}`,
        );
      }
      if (result.body === undefined) {
        res.writeHead(result.status).end();
        return;
      }
      res
        .writeHead(result.status, {
          'Content-Type': 'application/json; charset=utf-8',
        })
        .end(JSON.stringify(result.body));
    };

    const url = new URL(req.url ?? '/', 'http://localhost');
    if (
      req.method === 'POST' &&
      (url.pathname === '/__reset' || url.pathname === `${API_PREFIX}/__reset`)
    ) {
      reset();
      send(json(204));
      return;
    }
    if (!url.pathname.startsWith(`${API_PREFIX}/`)) {
      send(notFound(`Mock ${zone} API: routes live below ${API_PREFIX}/`));
      return;
    }
    const pathname = url.pathname.slice(API_PREFIX.length);
    if (req.method === 'GET' && pathname === '/health') {
      send(json(200, { ok: true, zone }));
      return;
    }

    let body;
    try {
      body = await readBody(req);
    } catch (error) {
      const { status = 400, message } =
        /** @type {Error & { status?: number }} */ (error);
      send(json(status, { message }));
      return;
    }
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    let methodMismatch = false;
    for (const route of routes) {
      const params = matchPath(route.path, pathname);
      if (!params) continue;
      if (route.method !== req.method) {
        methodMismatch = true;
        continue;
      }
      try {
        send(
          route.handler({
            params,
            query: url.searchParams,
            body,
            headers: req.headers,
          }),
        );
      } catch (error) {
        console.error(`[mock-api ${zone}]`, error);
        send(json(500, { message: 'Mock API error' }));
      }
      return;
    }
    send(
      methodMismatch
        ? json(405, { message: 'Method not allowed' })
        : notFound(),
    );
  });
}
