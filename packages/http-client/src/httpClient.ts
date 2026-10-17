/**
 * Ported from starter-mfe services/httpClient.ts.
 *
 * Differences:
 * - The base URL is injected at runtime (`createHttpClient({ baseUrl })`), typically from
 *   `mfe-manifest.json` `settings`, instead of being baked in at build time. One build runs in
 *   every environment.
 * - No bearer-token option: auth uses the backend-session (BFF) pattern and the browser never
 *   handles tokens (D6). Cookies are sent with `credentials` (default `same-origin`).
 */

export type HttpRequestOptions = {
  signal?: AbortSignal;
  headers?: HeadersInit;
  /** Overrides the client's default `credentials`. */
  credentials?: RequestCredentials;
};

export class HttpClientError extends Error {
  status: number;
  statusText: string;
  url: string;

  constructor(response: Response) {
    super(
      `${response.status} ${response.statusText || 'HTTP request failed'}`.trim(),
    );
    this.name = 'HttpClientError';
    this.status = response.status;
    this.statusText = response.statusText;
    this.url = response.url;
  }
}

export type HttpClientConfig = {
  /**
   * API base URL, or a function returning it (read lazily on every request, so it can come
   * from runtime config that loads after the client is created). Absolute (`https://api/...`)
   * or root-relative (`/api`).
   */
  baseUrl: string | (() => string);
  /** Default `credentials` for every request. Default `same-origin`. */
  credentials?: RequestCredentials;
  /** Headers added to every request. */
  headers?: HeadersInit;
  /** Custom fetch (tests, instrumentation). Default: global fetch. */
  fetch?: typeof fetch;
};

export interface HttpClient {
  /** Resolve an apiRoutes path (or an absolute URL, returned unchanged) against the base URL. */
  url(path: string): string;
  request(
    path: string,
    init?: RequestInit,
    options?: HttpRequestOptions,
  ): Promise<Response>;
  requestJson<T>(
    path: string,
    init?: RequestInit,
    options?: HttpRequestOptions,
  ): Promise<T>;
  getJson<T>(path: string, options?: HttpRequestOptions): Promise<T>;
  postJson<T>(
    path: string,
    body?: unknown,
    options?: HttpRequestOptions,
  ): Promise<T>;
  post(
    path: string,
    body?: unknown,
    options?: HttpRequestOptions,
  ): Promise<void>;
}

const ABSOLUTE_URL = /^[a-z][a-z\d+\-.]*:\/\//i;

/** Join a base URL and a relative path with exactly one slash. */
export function joinUrl(base: string, path: string): string {
  if (ABSOLUTE_URL.test(path)) return path;
  const trimmedBase = base.trim();
  if (!trimmedBase) {
    throw new Error(
      'HTTP client base URL is empty. Pass baseUrl to createHttpClient (e.g. from mfe-manifest.json settings).',
    );
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${trimmedBase.replace(/\/+$/, '')}${normalizedPath}`;
}

async function ensureOk(response: Response): Promise<Response> {
  if (!response.ok) {
    throw new HttpClientError(response);
  }
  return response;
}

async function parseJsonBody<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }
  const raw = await response.text();
  if (!raw) {
    return undefined as T;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    const preview = raw.slice(0, 80).replace(/\s+/g, ' ');
    throw new Error(`Expected JSON from ${response.url}, got: ${preview}`);
  }
}

function jsonBody(body: unknown): Pick<RequestInit, 'body' | 'headers'> {
  if (body === undefined) return {};
  return {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export function createHttpClient(config: HttpClientConfig): HttpClient {
  const getBase =
    typeof config.baseUrl === 'function'
      ? config.baseUrl
      : () => config.baseUrl as string;

  const url = (path: string) => joinUrl(getBase(), path);

  const request: HttpClient['request'] = async (
    path,
    init = {},
    options = {},
  ) => {
    const headers = new Headers(config.headers);
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    new Headers(options.headers).forEach((value, key) =>
      headers.set(key, value),
    );
    const doFetch = config.fetch ?? fetch;
    const response = await doFetch(url(path), {
      ...init,
      headers,
      signal: options.signal ?? init.signal,
      credentials:
        options.credentials ??
        init.credentials ??
        config.credentials ??
        'same-origin',
    });
    return ensureOk(response);
  };

  const requestJson: HttpClient['requestJson'] = async <T>(
    path: string,
    init?: RequestInit,
    options?: HttpRequestOptions,
  ) => parseJsonBody<T>(await request(path, init, options));

  return {
    url,
    request,
    requestJson,
    getJson: (path, options) => requestJson(path, {}, options),
    postJson: (path, body, options) =>
      requestJson(path, { method: 'POST', ...jsonBody(body) }, options),
    post: async (path, body, options) => {
      await request(path, { method: 'POST', ...jsonBody(body) }, options);
    },
  };
}
