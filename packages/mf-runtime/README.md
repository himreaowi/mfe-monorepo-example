# @org/mf-runtime

Runtime glue between shells and remotes (Module Federation 2 runtime API). Replaces starter-mfe's
build-time remotes (`loadRemote.tsx`, `FederatedRemoteApp`, `HostPropsContext`).

## Shell side (`@org/mf-runtime`)

```tsx
// src/bootstrap.tsx (after `import('./bootstrap')` in main.tsx)
import {
  initRemotes,
  loadMfeManifest,
  MfeManifestProvider,
} from '@org/mf-runtime';

const manifest = await loadMfeManifest(); // GET /mfe-manifest.json, validated
initRemotes(manifest); // registerRemotes([...]) on this build's MF runtime
root.render(
  <MfeManifestProvider manifest={manifest}>
    <App />
  </MfeManifestProvider>,
);

// routes
<Route
  path="apps/staff/*"
  element={<RemoteApp name="intranet_staff" props={{ user }} />}
/>;
```

| Export                                                                   | What                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `loadMfeManifest({ url?, fetch?, signal? })`                             | Fetch (`cache: 'no-cache'`) + parse + validate. Throws `MfeManifestError` (`issues[]`) for HTTP errors, non-JSON, schema violations                                                                                                                              |
| `parseMfeManifest(json)` / `validateMfeManifest(json)`                   | Validate already-parsed JSON (throwing / `{ ok, issues }`)                                                                                                                                                                                                       |
| `initRemotes(manifest)`                                                  | `registerRemotes` from `@module-federation/enhanced/runtime` (not `createInstance`, which would not share the shell's singletons). Root-relative entries resolve against the page origin                                                                         |
| `<RemoteApp name module? basePath? props? retries? loading? onError? />` | Error boundary + Suspense + `loadRemote('<name>/<module>')`. Failure → `RemoteFallback` (from `@org/ui`) with "Try again" (re-registers the remote, then loads again); `retries` automatic attempts first (default 1). Unknown name → fallback without a request |
| `MfeManifestProvider`, `useMfeManifest()`                                | Gives `<RemoteApp>` per-remote `props` and `settings`                                                                                                                                                                                                            |
| `mfe-manifest.schema.json`                                               | `@org/mf-runtime/mfe-manifest.schema.json`, for DevOps/CI validation of per-env manifests                                                                                                                                                                        |

The remote receives `HostProps`:
`{ settings, ...manifest remote props, ...props, embedded: true, basePath }` (`embedded` and
`basePath` cannot be overridden). `basePath` defaults to the URL part matched before the route's
splat: `/apps/staff/route-1` under `apps/staff/*` gives `/apps/staff`.

### Manifest

```json
{
  "remotes": {
    "intranet_staff": {
      "entry": "https://cdn.example.com/staff/mf-manifest.json",
      "props": { "title": "Staff" }
    },
    "intranet_leave": { "entry": "/remotes/leave/mf-manifest.json" }
  },
  "auth": {},
  "settings": { "apiBaseUrl": "https://api.example.com" }
}
```

Remote names must be the federation names (JS identifiers). `entry` must be an http(s) URL or a
root-relative path ending in `.json` (mf-manifest) or `.js` (remoteEntry). Unknown properties are
rejected (typo protection). Errors list every problem, e.g.:

```
Invalid MFE manifest (/mfe-manifest.json): does not match mfe-manifest.schema.json
  - (root): unknown property "extra"
  - remotes: invalid remote name "bad-name" (must be a JS identifier, the remote's federation name)
```

Validation uses an Ajv **standalone** validator generated from the schema
(`src/manifest/validateSchema.generated.js`, no Ajv and no `eval` at runtime, so it works under a
strict CSP). After editing the schema run `pnpm --filter @org/mf-runtime generate:validator`; a
unit test fails if the generated file is stale.

## Remote side (`@org/mf-runtime/remote`)

```tsx
// src/app/apps.tsx
export const { EmbeddedApp, StandaloneApp } = createRemoteApp({
  routes: [
    { index: true, element: <Navigate to="route-1" replace /> },
    { path: 'route-1', element: <Route1 /> },
  ],
  standaloneProps: {
    user: { id: 'mock' },
    settings: { apiBaseUrl: '/mock-api' },
  },
  StandaloneLayout: ({ children }) => (
    <MainLayout brand="Staff">{children}</MainLayout>
  ),
});

// src/app/RemoteApp.tsx (exposed as './App')
export { EmbeddedApp as default } from './apps';

// src/bootstrap.tsx (standalone only)
import '@org/design-tokens/global.scss';
createRoot(el).render(<StandaloneApp />);
```

|                  | Embedded (rendered by a shell)                                                                                                                                                      | Standalone (`pnpm dev` in the remote)                  |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Router           | The shell's router (react-router is a shared singleton). Routes are relative and match below the shell's splat mount. No router around it → own `BrowserRouter basename={basePath}` | Own `BrowserRouter`, routes match from `/`             |
| Theme            | `ThemeProvider` passes through to the shell's provider (shared `@org/ui`), or follows `<html>` if `@org/ui` is not shared. Never owns the document theme                            | `ThemeProvider` owns the document theme                |
| Host props       | From the shell (`embedded: true`, `basePath`, `settings`, `user`, …)                                                                                                                | `standaloneProps` + `embedded: false`, `basePath: '/'` |
| Global styles/SW | None (the shell has them)                                                                                                                                                           | Imported/registered by the standalone bootstrap        |

- `useHostProps()`: the host props.
- `useRemotePath()(to)`: absolute path inside the remote (`/apps/staff/route-2` embedded,
  `/route-2` standalone). Use it for links between remote pages: relative links inside a splat
  route are easy to get wrong.
- `HostProps`, `HostUser`, `normalizeBasePath`, `joinBasePath`.

`@org/mf-runtime` is not a shared singleton: the host part is only used by shells and the remote
part keeps its context inside the remote.
