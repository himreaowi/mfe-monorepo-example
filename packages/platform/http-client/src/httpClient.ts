import axios, { AxiosError, type AxiosResponse } from 'axios';

/**
 * Ported from starter-mfe services/httpClient.ts, on axios (fetch adapter). axios is private to
 * this package: features only see the API below (lint and `pnpm check` keep it that way).
 *
 * Differences:
 * - The base URL is injected at runtime (`createHttpClient({ baseUrl })`), typically from
 *   `mfe-manifest.json` `settings`, instead of being baked in at build time. One build runs in
 *   every environment.
 * - No bearer-token option: auth uses the backend-session (BFF) pattern and the browser never
 *   handles tokens (D6). Cookies are sent with `credentials` (default `same-origin`).
 */

/** Default time a request may take, in ms. 0 turns the timeout off. */
export const DEFAULT_TIMEOUT_MS = 30_000;

export type HttpRequestOptions = {
  signal?: AbortSignal;
  headers?: HeadersInit;
  /** Overrides the client's default `credentials`. */
  credentials?: RequestCredentials;
  /** Overrides the client's `timeout` (ms, 0 = none). */
  timeout?: number;
};

export class HttpClientError extends Error {
  status: number;
  statusText: string;
  url: string;
  /**
   * Parsed JSON body of the error response, e.g. `{ message, errors: { field: message } }` of a
   * 422 validation error. `undefined` when the body is empty or not JSON.
   */
  body: unknown;
  /** The request took too long and was cancelled (`status` is 0: there was no response). */
  timedOut: boolean;

  constructor(
    response: Pick<Response, 'status' | 'statusText' | 'url'>,
    body?: unknown,
    timeoutMs?: number,
  ) {
    super(
      timeoutMs === undefined
        ? `${response.status} ${response.statusText || 'HTTP request failed'}`.trim()
        : `Request timed out after ${timeoutMs} ms: ${response.url}`,
    );
    this.name = 'HttpClientError';
    this.status = response.status;
    this.statusText = response.statusText;
    this.url = response.url;
    this.body = body;
    this.timedOut = timeoutMs !== undefined;
  }
}

/**
 * True when no usable response came back: the connection failed (fetch rejects with a
 * `TypeError`) or the request timed out. Aborted requests, HTTP errors and bad bodies are not
 * network errors.
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof HttpClientError) return error.timedOut;
  // by name: a TypeError may come from another realm (tests)
  return (error as Error | null | undefined)?.name === 'TypeError';
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
  /** Time a request may take, in ms (0 = none). Default 30 s; then `HttpClientError.timedOut`. */
  timeout?: number;
  /**
   * Called on every 401 response, before the `HttpClientError` is thrown. Use it to re-check the
   * session (`useAuth().refresh`); it must not throw. `useApiClient()` wires it up.
   */
  onUnauthorized?: (error: HttpClientError) => void;
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

/** The error response's body as JSON, or `undefined` (empty, not JSON, or unreadable). */
async function readErrorBody(response: Response): Promise<unknown> {
  try {
    const raw = await response.text();
    return raw ? (JSON.parse(raw) as unknown) : undefined;
  } catch {
    return undefined;
  }
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

type FetchCallInit = RequestInit & { customFetch?: typeof fetch };

/**
 * Stands in for `Request` in axios's fetch adapter, so a request stays a plain
 * `fetch(url, init)` call: a real `Request` rejects root-relative URLs outside a browser
 * (unit tests, `baseUrl: '/api'`) and would hide `init` from a custom fetch. The `credentials`
 * getter matters: the adapter only passes `credentials` on when the class has that property.
 */
class FetchCall {
  readonly url: string;
  readonly init: FetchCallInit;

  constructor(url: string, init: FetchCallInit) {
    this.url = url;
    this.init = init;
  }

  get credentials() {
    return this.init.credentials;
  }
}

function runFetchCall({ url, init: { customFetch, ...init } }: FetchCall) {
  const doFetch = customFetch ?? fetch;
  return doFetch(url, { ...init, headers: new Headers(init.headers) });
}

/**
 * One instance for every client. Request and response bodies pass through untouched (the
 * helpers below do the JSON), every status resolves (`request()` maps it), and axios's XSRF
 * cookie handling is off: the CSRF token comes from the session and is passed as a header.
 * `env` must stay one object with stable members: the adapter caches a factory per member.
 */
const transport = axios.create({
  adapter: 'fetch',
  env: { Request: FetchCall, fetch: runFetchCall } as never,
  responseType: 'arraybuffer',
  transformRequest: [],
  transformResponse: [],
  validateStatus: () => true,
  withXSRFToken: false,
  xsrfCookieName: '',
  xsrfHeaderName: '',
});

/**
 * Headers axios would add on its own. `false` keeps them out (an extra User-Agent or Content-Type
 * would change what the browser sends, and may trigger a CORS preflight). The caller's win.
 */
const NO_AXIOS_HEADERS = {
  Accept: false,
  'Content-Type': false,
  'User-Agent': false,
};

/** The axios result as a fetch `Response`: the type `request()` has always returned. */
function toResponse(result: AxiosResponse<ArrayBuffer>, url: string): Response {
  const response = new Response(
    // a 204 or 304 must have a null body
    result.data.byteLength > 0 ? result.data : null,
    {
      status: result.status,
      statusText: result.statusText,
      headers: result.headers as Record<string, string>,
    },
  );
  Object.defineProperty(response, 'url', { value: url });
  return response;
}

/** What callers see instead of an AxiosError: the same errors `fetch` gave them. */
function toFetchError(
  error: unknown,
  url: string,
  timeoutMs: number,
  signal?: AbortSignal | null,
): unknown {
  if (signal?.aborted) return signal.reason;
  if (!(error instanceof AxiosError)) return error;
  if (error.code === AxiosError.ETIMEDOUT) {
    return new HttpClientError(
      { status: 0, statusText: 'Timeout', url },
      undefined,
      timeoutMs,
    );
  }
  const { cause } = error;
  if (error.code === AxiosError.ERR_NETWORK && !(cause instanceof TypeError)) {
    // Node puts the socket error here; browsers have the TypeError of fetch
    return new TypeError(error.message, { cause });
  }
  return cause ?? error;
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
    const { body, method, signal, credentials, ...fetchOptions } = init;
    const target = url(path);
    const abortSignal = options.signal ?? signal;
    const timeout = options.timeout ?? config.timeout ?? DEFAULT_TIMEOUT_MS;
    let result: AxiosResponse<ArrayBuffer>;
    try {
      result = await transport.request({
        url: target,
        method: method ?? 'GET',
        data: body,
        headers: { ...NO_AXIOS_HEADERS, ...Object.fromEntries(headers) },
        signal: abortSignal ?? undefined,
        timeout,
        // a string goes to fetch as `credentials`; axios's boolean type does not know that
        withCredentials: (options.credentials ??
          credentials ??
          config.credentials ??
          'same-origin') as unknown as boolean,
        fetchOptions: { ...fetchOptions, customFetch: config.fetch } as never,
      });
    } catch (error) {
      throw toFetchError(error, target, timeout, abortSignal);
    }
    const response = toResponse(result, target);
    if (response.ok) return response;
    const error = new HttpClientError(response, await readErrorBody(response));
    if (error.status === 401) config.onUnauthorized?.(error);
    throw error;
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
