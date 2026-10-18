# @org/http-client

Fetch wrapper ported from starter-mfe `services/httpClient.ts` + the `apiRoutes` pattern.

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

API: `createHttpClient({ baseUrl, credentials?, headers?, fetch? })` returns
`{ url, request, requestJson, getJson, postJson, post }`. `HttpClientError` (`status`,
`statusText`, `url`, `body`) for non-2xx responses; `body` is the parsed JSON of the error
response (e.g. a 422 `{ "message", "errors": { "<field>": "<message>" } }`), `undefined` when it
is empty or not JSON. `joinUrl(base, path)`. `defineApiRoutes(obj)`
(typed identity helper).

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
