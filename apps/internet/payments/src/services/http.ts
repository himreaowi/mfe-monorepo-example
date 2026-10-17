import { createHttpClient, type HttpClient } from '@org/http-client';

/**
 * HTTP client whose base URL comes from host props `settings.apiBaseUrl` (from the shell's
 * mfe-manifest.json, or standaloneProps). Auth is a backend session (cookies), never tokens.
 */
export function createApiClient(
  settings: Record<string, unknown> | undefined,
): HttpClient {
  return createHttpClient({
    baseUrl: () =>
      typeof settings?.apiBaseUrl === 'string' ? settings.apiBaseUrl : '',
  });
}
