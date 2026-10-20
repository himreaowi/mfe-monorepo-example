import { createHttpClient, type HttpClient } from './httpClient';

/** `settings.apiBaseUrl` (from mfe-manifest.json), or '' when the environment has none. */
export function apiBaseUrlFrom(
  settings: Record<string, unknown> | null | undefined,
): string {
  return typeof settings?.apiBaseUrl === 'string' ? settings.apiBaseUrl : '';
}

export type ApiClientOptions = {
  /** Custom fetch (tests, instrumentation). Default: global fetch. */
  fetch?: typeof fetch;
};

/**
 * The app's API client: base URL from `settings.apiBaseUrl` (runtime config from
 * mfe-manifest.json, one build for every environment), `credentials: 'include'` so the backend
 * session cookie also reaches a cross-origin API (BFF pattern: never tokens in the browser).
 *
 * React apps use `useApiClient()` from `@org/mf-runtime/remote` (remotes, settings from host
 * props) or `@org/mf-runtime` (shells, settings from the loaded manifest) instead.
 */
export function createApiClient(
  settings: Record<string, unknown> | null | undefined,
  options: ApiClientOptions = {},
): HttpClient {
  return createHttpClient({
    baseUrl: () => apiBaseUrlFrom(settings),
    credentials: 'include',
    fetch: options.fetch,
  });
}
