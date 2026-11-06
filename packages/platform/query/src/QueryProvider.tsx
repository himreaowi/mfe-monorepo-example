import type { ReactNode } from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';

export type QueryProviderProps = {
  /** Created once, at module level: the cache outlives this component. */
  client: QueryClient;
  /** Id of the signed-in user (`undefined` or `null` when there is none). */
  userId?: string | null;
  children: ReactNode;
};

/** The user each client's cache belongs to. Kept per client: a remote can unmount and return. */
const cacheOwners = new WeakMap<QueryClient, string | null>();

/**
 * `QueryClientProvider` that never shows one user's data to the next: `client.clear()` runs when
 * `userId` changes (sign-out, sign-in, another account). It runs during render, so the children
 * of this very render already read an empty cache, and it also catches a change that happened
 * while nothing was mounted (the user signed out while a remote was closed).
 */
export function QueryProvider({
  client,
  userId = null,
  children,
}: QueryProviderProps) {
  if (cacheOwners.has(client) && cacheOwners.get(client) !== userId) {
    // clear() alone tells nobody: a mounted component that does not re-render keeps showing the
    // old data. reset() makes its observer update first (asynchronously, not during this render).
    client
      .getQueryCache()
      .getAll()
      .forEach((query) => query.reset());
    client.clear();
  }
  cacheOwners.set(client, userId);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
