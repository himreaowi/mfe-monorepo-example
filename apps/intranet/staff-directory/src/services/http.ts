import { useMemo } from 'react';
import { createHttpClient, type HttpClient } from '@org/http-client';
import { useHostProps } from '@org/mf-runtime/remote';

/** `settings.apiBaseUrl` from mfe-manifest.json (via host props), or '' when missing. */
export function apiBaseUrl(
  settings: Record<string, unknown> | undefined,
): string {
  return typeof settings?.apiBaseUrl === 'string' ? settings.apiBaseUrl : '';
}

/**
 * HTTP client whose base URL comes from host props `settings.apiBaseUrl` (from the shell's
 * mfe-manifest.json, or standaloneProps). Auth is a backend session (cookies), never tokens;
 * the API is on another origin, so cookies need `credentials: 'include'`.
 */
export function createApiClient(
  settings: Record<string, unknown> | undefined,
): HttpClient {
  return createHttpClient({
    baseUrl: () => apiBaseUrl(settings),
    credentials: 'include',
  });
}

/** The API client for this render tree; a new one only when `apiBaseUrl` changes. */
export function useApiClient(): HttpClient {
  const { settings } = useHostProps();
  const baseUrl = apiBaseUrl(settings);
  return useMemo(() => createApiClient({ apiBaseUrl: baseUrl }), [baseUrl]);
}
