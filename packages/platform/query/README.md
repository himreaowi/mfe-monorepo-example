# @org/query

TanStack Query setup shared by every app. Nothing of TanStack Query is re-exported: hooks import
`useQuery` / `useMutation` from `@tanstack/react-query` themselves, only in `hooks/` folders
(`pnpm check` and ESLint enforce it).

- `createQueryClient()`: `staleTime` 30 s, no refetch on window focus; queries retry once, and only
  network errors (connection failed, timeout) and status >= 500, never a 4xx or an abort
  (`shouldRetryQuery`); mutations never retry.
- `<QueryProvider client userId>`: `QueryClientProvider` that calls `client.clear()` when `userId`
  changes (sign-out, sign-in), before the children render, so a user never sees the previous
  user's data. It also notices a change that happened while it was unmounted.

Remotes get all this from `createRemoteApp` (one client per remote, at module level, so the cache
survives leaving and returning to the remote). A shell makes its own client in `src/app/App.tsx`.

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
