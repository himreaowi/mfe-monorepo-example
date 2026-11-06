# @org/http-client

HTTP client ported from starter-mfe `services/httpClient.ts` + the `apiRoutes` pattern. It runs on
axios with the fetch adapter; axios stays private to this package (`pnpm check` rule `axios-import`),
callers see the API below.

```ts
import { createHttpClient, defineApiRoutes } from '@org/http-client';

export const apiRoutes = defineApiRoutes({
  posts: { byId: (id: number | string) => `/posts/${id}` },
});

// Base URL comes from runtime config (e.g. mfe-manifest.json settings.apiBaseUrl, passed to
// remotes as host props), never baked in at build time.
export const http = createHttpClient({ baseUrl: () => settings.apiBaseUrl });

const post = await http.getJson<Post>(apiRoutes.posts.byId(1), { signal });
```

API: `createHttpClient({ baseUrl, credentials?, headers?, fetch?, timeout?, onUnauthorized? })`
returns `{ url, requestJson, getJson, postJson, post }`. `HttpClientError` (`status`,
`statusText`, `url`, `body`, `failure`) for non-2xx responses and for requests without a response; `body` is the parsed JSON of the error
response (e.g. a 422 `{ "message", "errors": { "<field>": "<message>" } }`), `undefined` when it
is empty or not JSON. `joinUrl(base, path)`. `defineApiRoutes(obj)`
(typed identity helper).

No response at all is an `HttpClientError` too: `status` 0, `failure` `'network'` (axios's
`ERR_NETWORK`) or `'timeout'`. `isNetworkError(error)` is true for those two only: a bug such as a
`TypeError` in your code is not one. An aborted `signal` rejects with its `AbortError`.

- `timeout`: ms per request, default 30 000 (`DEFAULT_TIMEOUT_MS`), 0 = none, also per request
  (`{ timeout }`). A timeout rejects with `HttpClientError` (`failure: 'timeout'`).
- `onUnauthorized(error)`: called on every 401, before the error is thrown. It must not throw.
- axios's XSRF cookie handling is off: the CSRF token comes from the session and is passed as a
  header. axios adds no `User-Agent` or default `Content-Type`; it does send its default `Accept`
  (`application/json, text/plain, */*`), which any request may override.
- `requireApiClient(client)` / `API_NOT_CONFIGURED`: use the possibly undefined client of
  `useApiClient()` inside a `queryFn` or `mutationFn`: it rejects instead of sending nothing.

`createApiClient(settings, { fetch?, timeout?, onUnauthorized? })`: the apps' client, base URL from
`settings.apiBaseUrl` (mfe-manifest.json), `credentials: 'include'`; `apiBaseUrlFrom(settings)`.
React apps call `useApiClient()` instead (`@org/mf-runtime/remote` in a remote, settings from
host props; `@org/mf-runtime` in a shell, settings from the loaded manifest). It lives in
`@org/mf-runtime` because that package owns host props and the manifest context; this package
stays framework-free (no React) and depends on no other workspace package, so `@org/mf-runtime` → `@org/http-client`
cannot form a cycle.

A custom `fetch` (tests) receives a `Request`, so the URL must be absolute outside a browser: use
`http://api.test/api` as the base URL in unit tests.

No bearer-token option: auth is a backend session (BFF, cookies), so the browser never handles
tokens. Use `credentials: 'include'` for a cross-origin BFF.

```ts
try {
  await http.postJson(apiRoutes.items.list(), draft);
} catch (error) {
  if (error instanceof HttpClientError && error.status === 422) {
    const { errors } = error.body as { errors?: Record<string, string> };
    // show errors next to the fields (docs/coding-conventions.md, forms)
  }
}
```
