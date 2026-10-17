# mfe-monorepo-template

Template monorepo for React microfrontends: pnpm workspaces + Nx (package-based) + Rspack +
Module Federation 2 (`@module-federation/enhanced`).

**Status: phase A3 (shared packages + mf-runtime).** There are no apps yet (generators come in A4).

## What's here

| Path                       | Contents                                                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `apps/`                    | Empty. Generators will add `apps/<zone>/<name>`                                                                              |
| `packages/tsconfig`        | `@org/tsconfig`: `base.json`, `react-app.json`, `library.json`                                                               |
| `packages/eslint-config`   | `@org/eslint-config`: shared flat config (TS, React hooks, Prettier)                                                         |
| `packages/prettier-config` | `@org/prettier-config`: shared Prettier options                                                                              |
| `packages/jest-config`     | `@org/jest-config`: Jest 30 preset (jsdom, SWC, Testing Library)                                                             |
| `packages/design-tokens`   | `@org/design-tokens`: tokens.css, global.scss, theme types/constants                                                         |
| `packages/ui`              | `@org/ui`: Button, ThemeToggle, RemoteFallback, ConnectionRequired, MainLayout, ThemeProvider                                |
| `packages/http-client`     | `@org/http-client`: fetch wrapper, runtime base URL, apiRoutes pattern                                                       |
| `packages/pwa`             | `@org/pwa`: registerPwa, useOnlineStatus, Workbox (workbox-build) Rspack plugin                                              |
| `packages/mf-runtime`      | `@org/mf-runtime`: mfe-manifest loader + JSON schema, initRemotes, `<RemoteApp>`, remote-side `createRemoteApp` / host props |
| `packages/rspack-config`   | `@org/rspack-config`: createShellConfig / createRemoteConfig (Rspack + MF 2)                                                 |
| `tools/`                   | Empty (generators and scripts come later)                                                                                    |
| `docs/toolchain.md`        | Pinned versions, the A0 spike evidence, gotchas                                                                              |
| `pnpm-workspace.yaml`      | Workspace globs, the default catalog (one version per core library), isolated linker                                         |
| `version-exceptions.json`  | Justified opt-outs from the catalog (empty)                                                                                  |
| `nx.json`                  | Task caching and defaults for `build`, `lint`, `test`, `typecheck`                                                           |

## Getting started

```sh
nvm use            # Node 24
corepack enable    # provides the pnpm version pinned in package.json
pnpm install
pnpm lint
pnpm test
pnpm typecheck
pnpm format:check
```

Each package has its own `node_modules` (pnpm isolated layout). Add a dependency to the package
that uses it (`pnpm --filter <pkg> add <dep>`). Packages in the catalog are written as `catalog:`.
See `docs/toolchain.md`.
