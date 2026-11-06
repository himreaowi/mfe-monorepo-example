import { QueryClient } from '@tanstack/react-query';
import { HttpClientError, isNetworkError } from '@org/http-client';

/**
 * Retry rule of every query: once, and only when trying again can help: the connection failed,
 * the request timed out, or the server answered 5xx. Never a 4xx (the same request fails the
 * same way), never an aborted request, a bad response body or a missing API.
 */
export function shouldRetryQuery(failureCount: number, error: unknown) {
  if (failureCount >= 1) return false;
  if (error instanceof HttpClientError && error.status >= 500) return true;
  return isNetworkError(error);
}

/**
 * A QueryClient with the shared defaults (docs/coding-conventions.md "Data fetching"). Data is
 * fresh for 30 s, a window focus does not refetch, mutations never retry (they may not be safe to
 * repeat). `createRemoteApp` makes one per remote; a shell makes its own in `src/app/App.tsx`.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: shouldRetryQuery,
      },
      mutations: { retry: false },
    },
  });
}
