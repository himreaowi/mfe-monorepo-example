# @org/mf-runtime

Runtime glue between shells and remotes (Module Federation 2 runtime API). Replaces starter-mfe's
build-time remotes (`loadRemote.tsx`, `FederatedRemoteApp`, `HostPropsContext`).

## Shell side (`@org/mf-runtime`)

```tsx
// src/main.tsx (the entry; MF async startup negotiated the shared singletons already)
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

| Export                                                                   | What                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `loadMfeManifest({ url?, fetch?, signal? })`                             | Fetch (`cache: 'no-cache'`) + parse + validate. Throws `MfeManifestError` (`issues[]`) for HTTP errors, non-JSON, schema violations                                                                                                                                                                  |
| `parseMfeManifest(json)` / `validateMfeManifest(json)`                   | Validate already-parsed JSON (throwing / `{ ok, issues }`)                                                                                                                                                                                                                                           |
| `initRemotes(manifest)`                                                  | `registerRemotes` from `@module-federation/enhanced/runtime` (not `createInstance`, which would not share the shell's singletons). Root-relative entries resolve against the page origin. Also registers `remoteCssPlugin` (below)                                                                   |
| `remoteCssPlugin` / `registerRemoteCssPlugin()`                          | MF runtime plugin: removes `.css` from the preloads MF starts for `loadRemote`, so a remote's extracted CSS is loaded only by the remote's own chunk loader, which awaits each `<link>` (no unstyled flash) and rejects on a failed one (→ `RemoteFallback`). See docs/toolchain.md "CSS extraction" |
| `<RemoteApp name module? basePath? props? retries? loading? onError? />` | Error boundary + Suspense + `loadRemote('<name>/<module>')`. Failure → `RemoteFallback` (from `@org/ui`) with "Try again" (re-registers the remote, then loads again); `retries` automatic attempts first (default 1). Unknown name → fallback without a request                                     |
| `MfeManifestProvider`, `useMfeManifest()`                                | Gives `<RemoteApp>` per-remote `props` and `settings`                                                                                                                                                                                                                                                |
| `useApiClient()`                                                         | The shell's API client (`@org/http-client` `createApiClient`): base URL from the manifest's `settings.apiBaseUrl`, `credentials: 'include'`; `undefined` without one                                                                                                                                 |
| `mfe-manifest.schema.json`                                               | `@org/mf-runtime/mfe-manifest.schema.json`, for DevOps/CI validation of per-env manifests                                                                                                                                                                                                            |

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
  "auth": {
    "sessionUrl": "/auth/session",
    "loginUrl": "/auth/login",
    "logoutUrl": "/auth/logout"
  },
  "settings": { "apiBaseUrl": "/api" }
}
```

`auth` is read by `@org/auth` `loadAuthClient` (BFF endpoints, or `{ "mock": true }` in
development; see [docs/auth-contract.md](../../docs/auth-contract.md)). Without `auth` the shell
disables sign-in.

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
// src/app/apps.tsx: the exposed module ('./App'); default export = the embedded app
const { EmbeddedApp, StandaloneApp } = createRemoteApp({
  routes: [
    { index: true, element: <Navigate to="route-1" replace /> },
    { path: 'route-1', element: <Route1 /> },
  ],
  standaloneProps: {
    user: { id: 'mock' },
    settings: { apiBaseUrl: '/mock-api' },
  },
  // the remote's own chrome for standalone mode (generated: src/layouts/StandaloneLayout)
  StandaloneLayout,
  // optional: app-level providers (remote-wide Context state), in both modes, outermost first
  providers: [AppStateProvider],
});

export default EmbeddedApp;
export { StandaloneApp };

// src/main.tsx (standalone only)
import '@org/design-tokens/global.scss';
createRoot(el).render(<StandaloneApp />);
```

|                  | Embedded (rendered by a shell)                                                                                                                                                      | Standalone (`pnpm dev` in the remote)                  |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Router           | The shell's router (react-router is a shared singleton). Routes are relative and match below the shell's splat mount. No router around it → own `BrowserRouter basename={basePath}` | Own `BrowserRouter`, routes match from `/`             |
| Theme            | `ThemeProvider` passes through to the shell's provider (shared `@org/ui`), or follows `<html>` if `@org/ui` is not shared. Never owns the document theme                            | `ThemeProvider` owns the document theme                |
| Host props       | From the shell (`embedded: true`, `basePath`, `settings`, `user`, …)                                                                                                                | `standaloneProps` + `embedded: false`, `basePath: '/'` |
| Global styles/SW | None (the shell has them)                                                                                                                                                           | Imported/registered by the standalone `src/main.tsx`   |

- `createRemoteApp({ routes, standaloneProps?, StandaloneLayout?, providers? })`: `providers`
  (one component or a list, outermost first) wrap the routes in both modes, inside the router
  and the host props (they may use `useHostProps()`, `useNavigate()`); standalone they wrap the
  `StandaloneLayout` too. For remote-wide state (`src/state/`, docs/coding-conventions.md
  "State management").
- `useHostProps()`: the host props.
- `useApiClient()`: the remote's API client (`createApiClient` from `@org/http-client`): base URL
  from host props `settings.apiBaseUrl`, `credentials: 'include'`, memoised per base URL;
  `undefined` when the environment has no `settings.apiBaseUrl`. Use it in feature hooks; no
  per-remote `services/http.ts`.
- `useRemotePath()(to)`: absolute path inside the remote (`/apps/staff/route-2` embedded,
  `/route-2` standalone). Use it for links between remote pages: relative links inside a splat
  route are easy to get wrong.
- `HostProps`, `HostUser`, `normalizeBasePath`, `joinBasePath`.
- `user` (`HostUser`: `{ id, name?, roles? }`) is set by the generated shell from `@org/auth`:
  the user when signed in, `null` when signed out, `undefined` when the environment has no auth.
  A remote may also call `useAuth()` from `@org/auth` (shared singleton) for `csrfToken`,
  `signOut()` or `refresh()` after an API 401.

## External modules (`@org/mf-runtime/external`)

The **mount contract** for modules built outside this repo (vendors, other frameworks, other
React majors) and the host component that drives it. Full guide:
[docs/external-modules.md](../../docs/external-modules.md).

```tsx
import { ExternalModule } from '@org/mf-runtime/external';

<ExternalModule
  name="internet_payments"
  config={{
    url: 'https://vendor.example/pay/1.4.2/mount.js',
    format: 'esm',
    integrity: 'sha384-…',
  }}
  basePath="/payments"
  path={splat}
  theme={theme}
  user={user}
  onNavigate={(to) => navigate(to.startsWith('/') ? to : `/payments/${to}`)}
  onEvent={(name, detail) => track(name, detail)}
  onError={(error) => report(error)}
/>;
```

| Export                                                                                     | What                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MOUNT_CONTRACT_VERSION`, `MountProps`, `MountedModule`, `MountFunction`, …                | The contract (`src/external/contract.ts`, no imports; shipped to vendors as `mount-contract.d.ts`)                                                                                                   |
| `<ExternalModule>`                                                                         | Load (`esm` / `web-component` / `script` / `mf`) with timeout, version check, mount into its own div, `update()` on prop changes, `unmount()` on leave; any failure → `RemoteFallback` + "Try again" |
| `validateExternalModuleConfig(value)`                                                      | `{ ok, config }` / `{ ok: false, issues }` for `props.vendor` from the manifest                                                                                                                      |
| `loadExternalModule(config, opts)`, `withTimeout`, `toExternalModule`, `webComponentMount` | Framework-free loader (also compiled into the vendor kit test host)                                                                                                                                  |
| `ExternalModuleLoadError` (`code`)                                                         | `invalid-config`, `load-failed`, `timeout`, `invalid-module`, `incompatible-contract`, `mount-failed`, …                                                                                             |

`pnpm gen:remote <zone> <name> --external` generates an adapter remote that renders
`<ExternalModule>` from its manifest `props.vendor`.

`@org/mf-runtime` is not a shared singleton: the host part is only used by shells and the remote
part keeps its context inside the remote.
