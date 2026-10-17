import { createHttpClient, type HttpClient } from '@org/http-client';

/**
 * HTTP client whose base URL comes from mfe-manifest.json `settings.apiBaseUrl` (runtime
 * config, one build for every environment). Auth is a backend session (cookies), never tokens.
 */
export function createApiClient(
  settings: Record<string, unknown> | undefined,
): HttpClient {
  return createHttpClient({
    baseUrl: () =>
      typeof settings?.apiBaseUrl === 'string' ? settings.apiBaseUrl : '',
  });
}
