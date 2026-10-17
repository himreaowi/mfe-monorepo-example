# @org/use-api

Data-fetching hooks shared by the example remotes (code sharing through `packages/`, never
between apps). Each remote bundles its own copy: the hooks hold no cross-app state, so this is
not a tier-1 runtime singleton.

| Export            | What                                                                                          |
| ----------------- | --------------------------------------------------------------------------------------------- |
| `useApi(load)`    | runs `load(signal)`; `{ status: 'loading' \| 'success' \| 'error', data?, error?, reload() }` |
| `useSubmit(send)` | for POST/PUT from event handlers; `{ state, submit(input) → outcome, reset() }`               |
| `toError(value)`  | normalises a rejection to `Error`                                                             |

`load` must be stable between renders: wrap it in `useCallback` with its inputs as dependencies.
Changing it (or calling `reload()`) aborts the previous request; a stale response never wins.

```tsx
// features/staff/hooks/useStaffMember.ts
export function useStaffMember(id: string) {
  const http = useApiClient();
  const load = useCallback(
    (signal: AbortSignal) => getStaffMember(http, id, signal),
    [http, id],
  );
  return useApi(load);
}
```

Request functions live in the remote's `features/<name>/api/` and use the remote's HTTP client
(`services/http.ts`, base URL from `settings.apiBaseUrl`), as in docs/coding-conventions.md.
