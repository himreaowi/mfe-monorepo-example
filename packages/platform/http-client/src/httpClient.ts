import axios, { AxiosError } from 'axios';

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

export type HttpRequestInit = Pick<
  RequestInit,
  'method' | 'headers' | 'signal' | 'credentials'
> & { body?: string | FormData | URLSearchParams | Blob };

/** Safe to show to a user: the URL is in `error.url`. */
const FAILURE_MESSAGES = {
  network: 'Could not reach the server.',
  timeout: 'The server took too long to answer.',
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
  /** Set when no response came back; `status` is then 0. */
  failure?: 'network' | 'timeout';

  constructor(
    response: Pick<Response, 'status' | 'statusText' | 'url'>,
    body?: unknown,
    failure?: 'network' | 'timeout',
  ) {
    super(
      failure
        ? FAILURE_MESSAGES[failure]
        : `${response.status} ${response.statusText || 'HTTP request failed'}`.trim(),
    );
    this.name = 'HttpClientError';
    this.status = response.status;
    this.statusText = response.statusText;
    this.url = response.url;
    this.body = body;
    this.failure = failure;
  }
}

/** True when no response came back: the connection failed or the request timed out. */
export function isNetworkError(error: unknown): boolean {
  return error instanceof HttpClientError && error.failure !== undefined;
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
  /** Custom fetch (tests, instrumentation); it receives a `Request`. Default: global fetch. */
  fetch?: typeof fetch;
  /** Time a request may take, in ms (0 = none). Default 30 s. */
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
  requestJson<T>(
    path: string,
    init?: HttpRequestInit,
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

/** Bodies stay text: the helpers below parse them. XSRF is off: our token comes from the session. */
const transport = axios.create({
  adapter: 'fetch',
  responseType: 'text',
  transformResponse: [(data: string) => data],
  withXSRFToken: false,
});

/** Headers axios would add by itself (`false` keeps them out); they could trigger a preflight. */
const NO_AUTOMATIC_HEADERS = { 'Content-Type': false, 'User-Agent': false };

const WITH_CREDENTIALS = {
  include: true,
  omit: false,
  'same-origin': undefined,
};

/** The error response's body as JSON, or `undefined` (empty or not JSON). */
function parseErrorBody(raw: string): unknown {
  try {
    return raw ? (JSON.parse(raw) as unknown) : undefined;
  } catch {
    return undefined;
  }
}

function parseJsonBody<T>(raw: string, url: string): T {
  if (!raw) return undefined as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    const preview = raw.slice(0, 80).replace(/\s+/g, ' ');
    throw new Error(`Expected JSON from ${url}, got: ${preview}`);
  }
}

/** What callers get instead of an AxiosError. An abort stays the AbortError of its signal. */
function toClientError(
  error: unknown,
  url: string,
  signal?: AbortSignal | null,
): unknown {
  if (signal?.aborted) return signal.reason;
  if (!(error instanceof AxiosError)) return error;
  const { code, response } = error;
  if (response) {
    const { status, statusText, data } = response;
    return new HttpClientError(
      { status, statusText, url },
      parseErrorBody(data as string),
    );
  }
  const noResponse = { status: 0, statusText: '', url };
  if (code === AxiosError.ETIMEDOUT) {
    return new HttpClientError(noResponse, undefined, 'timeout');
  }
  if (code === AxiosError.ERR_NETWORK) {
    return new HttpClientError(noResponse, undefined, 'network');
  }
  return error;
}

function jsonBody(body: unknown): HttpRequestInit {
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

  const send = async (
    path: string,
    init: HttpRequestInit = {},
    options: HttpRequestOptions = {},
  ) => {
    const target = url(path);
    const signal = options.signal ?? init.signal;
    const headers = new Headers(config.headers);
    for (const extra of [init.headers, options.headers]) {
      new Headers(extra).forEach((value, key) => headers.set(key, value));
    }
    const credentials =
      options.credentials ??
      init.credentials ??
      config.credentials ??
      'same-origin';
    try {
      const response = await transport.request<string>({
        url: target,
        method: init.method,
        data: init.body,
        headers: { ...NO_AUTOMATIC_HEADERS, ...Object.fromEntries(headers) },
        signal: signal ?? undefined,
        timeout: options.timeout ?? config.timeout ?? DEFAULT_TIMEOUT_MS,
        withCredentials: WITH_CREDENTIALS[credentials],
        env: config.fetch ? { fetch: config.fetch } : undefined,
      });
      return { raw: response.data, url: target };
    } catch (error) {
      const failure = toClientError(error, target, signal);
      if (failure instanceof HttpClientError && failure.status === 401) {
        config.onUnauthorized?.(failure);
      }
      throw failure;
    }
  };

  const requestJson: HttpClient['requestJson'] = async <T>(
    path: string,
    init?: HttpRequestInit,
    options?: HttpRequestOptions,
  ) => {
    const { raw, url: target } = await send(path, init, options);
    return parseJsonBody<T>(raw, target);
  };

  return {
    url,
    requestJson,
    getJson: (path, options) => requestJson(path, {}, options),
    postJson: (path, body, options) =>
      requestJson(path, { method: 'POST', ...jsonBody(body) }, options),
    post: async (path, body, options) => {
      await send(path, { method: 'POST', ...jsonBody(body) }, options);
    },
  };
}
