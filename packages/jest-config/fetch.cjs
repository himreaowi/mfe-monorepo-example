// Fake fetch for unit tests (no network): `createFakeFetch(routes)` and `jsonResponse(body)`.
// Needs the global `Response` (Node, or the jsdom environment of @org/jest-config).

/**
 * @param {unknown} body
 * @param {{ status?: number, statusText?: string, headers?: Record<string, string>, url?: string }} [init]
 * @returns {Response}
 */
function jsonResponse(body, init = {}) {
  const status = init.status ?? 200;
  const empty = body === undefined || status === 204 || status === 304;
  // `new Response('', { status: 204 })` throws: a null-body status needs a null body
  const response = new Response(empty ? null : JSON.stringify(body), {
    status,
    statusText: init.statusText ?? '',
    headers: empty
      ? init.headers
      : { 'Content-Type': 'application/json', ...init.headers },
  });
  if (init.url) Object.defineProperty(response, 'url', { value: init.url });
  return response;
}

/** @param {unknown} body */
function parseBody(body) {
  if (typeof body !== 'string') return body;
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

/**
 * A `fetch` that answers from a route table and records every call.
 *
 *   const fetch = createFakeFetch({
 *     'GET /api/items': { body: [{ id: 1, name: 'First' }] },
 *     'POST /api/items': ({ body }) => (body.name ? { status: 201, body } : { status: 422, body: { errors: { name: 'Required' } } }),
 *   });
 *   const http = createHttpClient({ baseUrl: 'http://api.test/api', fetch });
 *
 * Keys: `"<METHOD> <pathname>"` (or just `"<pathname>"` for any method). Values: `{ status?, body? }`,
 * a `Response`, or a function of `{ url, method, pathname, query, body, init }` returning either.
 * Unknown routes answer 404 `{ message }`. An aborted `signal` rejects with an `AbortError`.
 *
 * @param {Record<string, unknown>} routes
 */
function createFakeFetch(routes = {}) {
  /** @type {Array<{ url: string, method: string, pathname: string, body: unknown, init: RequestInit }>} */
  const calls = [];
  /** @param {string | URL | Request} input @param {RequestInit} [init] */
  async function fakeFetch(input, init = {}) {
    const url = typeof input === 'string' ? input : String(input.url ?? input);
    const method = String(init.method ?? 'GET').toUpperCase();
    const parsed = new URL(url, 'http://localhost');
    const call = {
      url,
      method,
      pathname: parsed.pathname,
      query: parsed.searchParams,
      body: parseBody(init.body),
      init,
    };
    calls.push(call);
    if (init.signal?.aborted) {
      throw Object.assign(new Error('The operation was aborted.'), {
        name: 'AbortError',
      });
    }
    const route =
      routes[`${method} ${parsed.pathname}`] ?? routes[parsed.pathname];
    if (route === undefined) {
      return jsonResponse(
        {
          message: `createFakeFetch: no route for ${method} ${parsed.pathname}`,
        },
        { status: 404, statusText: 'Not Found', url },
      );
    }
    const result = typeof route === 'function' ? await route(call) : route;
    if (result instanceof Response) return result;
    const { status = 200, body, headers } = /** @type {any} */ (result ?? {});
    return jsonResponse(body, { status, headers, url });
  }
  fakeFetch.calls = calls;
  return fakeFetch;
}

module.exports = { createFakeFetch, jsonResponse };
