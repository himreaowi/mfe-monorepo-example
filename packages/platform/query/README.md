# @org/query

TanStack Query setup shared by every app. Nothing of TanStack Query is re-exported: hooks import
`useQuery` / `useMutation` from `@tanstack/react-query` themselves, only in `hooks/` folders
(`pnpm check` and ESLint enforce it).

- `createQueryClient()`: `staleTime` 30 s, no refetch on window focus; queries retry once, and only
  network errors (connection failed, timeout) and status >= 500, never a 4xx or an abort
  (`shouldRetryQuery`); mutations never retry.
- `<QueryProvider client? userId>`: `QueryClientProvider` that calls `client.clear()` when `userId`
  changes (sign-out, sign-in), before the children render, so a user never sees the previous
  user's data. Without `client` it creates one when it mounts and drops it on unmount.

Remotes get all this from `createRemoteApp`, with no `client`: the cache lives while the remote is
open (navigation inside it keeps it) and is discarded when the remote unmounts, i.e. on leaving
it or on sign-out of a private remote. Why: personal data must not stay in memory after the user
left or signed out, and a remote that is unmounted cannot see the sign-out happen. A shell is
never unmounted, so it makes its own client at module level in `src/app/App.tsx` and passes it.

## Tests

`@org/query/test` (test code only, it imports Testing Library):

```tsx
import { renderHookWithQuery, renderWithQuery } from '@org/query/test';

const { result, queryClient } = renderHookWithQuery(() => useItems(), {
  wrapper: hostProps, // goes inside the QueryClientProvider
});
renderWithQuery(<Thing />);
```

Each call makes a fresh client without retries (`createTestQueryClient()`), or pass `queryClient`.
