import { useMemo } from 'react';
import {
  apiBaseUrlFrom,
  createApiClient,
  type HttpClient,
} from '@org/http-client';

/**
 * The API client for `settings` (`settings.apiBaseUrl`, `credentials: 'include'`), memoised on
 * the base URL; `undefined` when no `settings.apiBaseUrl` is set. Shared by the host-side and
 * remote-side `useApiClient()`.
 */
export function useApiClientFor(
  settings: Record<string, unknown> | null | undefined,
): HttpClient | undefined {
  const baseUrl = apiBaseUrlFrom(settings);
  return useMemo(
    () => (baseUrl ? createApiClient({ apiBaseUrl: baseUrl }) : undefined),
    [baseUrl],
  );
}
