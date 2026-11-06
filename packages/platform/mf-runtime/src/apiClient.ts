import { useEffect, useMemo, useRef } from 'react';
import {
  apiBaseUrlFrom,
  createApiClient,
  type HttpClient,
} from '@org/http-client';

/**
 * The API client for `settings` (`settings.apiBaseUrl`, `credentials: 'include'`), memoised on
 * the base URL; `undefined` when no `settings.apiBaseUrl` is set. Shared by the host-side and
 * remote-side `useApiClient()`. A 401 calls the latest `onUnauthorized`: a new callback does not
 * make a new client.
 */
export function useApiClientFor(
  settings: Record<string, unknown> | null | undefined,
  onUnauthorized?: () => void,
): HttpClient | undefined {
  const baseUrl = apiBaseUrlFrom(settings);
  const latest = useRef(onUnauthorized);
  useEffect(() => {
    latest.current = onUnauthorized;
  });
  return useMemo(
    () =>
      baseUrl
        ? createApiClient(
            { apiBaseUrl: baseUrl },
            { onUnauthorized: () => latest.current?.() },
          )
        : undefined,
    [baseUrl],
  );
}
