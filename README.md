# mfe-monorepo-template

Template monorepo for React microfrontends: pnpm workspaces + Nx (package-based) + Rspack +
Module Federation 2 (`@module-federation/enhanced`).

**Status: phase A8 (testing: Playwright e2e + axe per zone).** `apps/` is empty: create apps with the generators.

## What's here

| Path                          | Contents                                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/`                       | Empty. `pnpm gen:shell` / `pnpm gen:remote` add `apps/<zone>/<name>`                                                                  |
| `packages/tsconfig`           | `@org/tsconfig`: `base.json`, `react-app.json`, `library.json`                                                                        |
| `packages/eslint-config`      | `@org/eslint-config`: shared flat config (TS, React hooks, Prettier)                                                                  |
| `packages/prettier-config`    | `@org/prettier-config`: shared Prettier options                                                                                       |
| `packages/jest-config`        | `@org/jest-config`: Jest 30 preset (jsdom, SWC, Testing Library)                                                                      |
| `packages/playwright-config`  | `@org/playwright-config`: zone e2e config (desktop + 375px, zone dev servers), console-error fixture, axe WCAG 2.2 AA helper          |
| `packages/design-tokens`      | `@org/design-tokens`: tokens.css, global.scss, theme types/constants                                                                  |
| `packages/ui`                 | `@org/ui`: Button, ThemeToggle, RemoteFallback, ConnectionRequired, MainLayout, ThemeProvider                                         |
| `packages/http-client`        | `@org/http-client`: fetch wrapper, runtime base URL, apiRoutes pattern                                                                |
| `packages/pwa`                | `@org/pwa`: registerPwa, useOnlineStatus, Workbox (workbox-build) Rspack plugin                                                       |
| `packages/auth`               | `@org/auth`: AuthProvider, useAuth, RequireAuth, UserMenu, BFF session client, dev-only mock (tier-1 singleton)                       |
| `packages/mf-runtime`         | `@org/mf-runtime`: mfe-manifest loader + JSON schema, initRemotes, `<RemoteApp>`, remote helpers, mount contract + `<ExternalModule>` |
| `packages/vendor-kit`         | `@org/vendor-kit`: what vendors get (contract `.d.ts`, standalone test host, examples, checklist), `pack:kit` → zip                   |
| `packages/rspack-config`      | `@org/rspack-config`: createShellConfig / createRemoteConfig (Rspack + MF 2)                                                          |
| `tools/generators`            | `@org/generators`: `pnpm gen:shell <zone>`, `pnpm gen:remote <zone> <name> [--private] [--external]`                                  |
| `tools/mock-vendor`           | `@org/mock-vendor` (dev only): mock vendor module without React on :3999 (`esm`, `web-component`)                                     |
| `tools/scripts`               | `@org/scripts`: `pnpm check` (check-versions, check-apps), `mfe-preview`                                                              |
| `docs/toolchain.md`           | Pinned versions, the A0 spike evidence, gotchas                                                                                       |
| `docs/adding-dependencies.md` | Dependency tiers (catalog, app-local, exceptions) with commands                                                                       |
| `docs/guardrails.md`          | Every check and how to fix its failures                                                                                               |
| `docs/external-modules.md`    | Vendor/other-framework integration: decision table, mount contract, security, vendor onboarding                                       |
| `docs/auth-contract.md`       | BFF endpoints, user object, cookies, CSRF, CORS, expiry: what the backend must provide                                                |
| `pnpm-workspace.yaml`         | Workspace globs, the default catalog (one version per core library), isolated linker                                                  |
| `version-exceptions.json`     | Justified opt-outs from the catalog (empty)                                                                                           |
| `nx.json`                     | Task caching and defaults for `build`, `lint`, `test`, `typecheck`                                                                    |

## Getting started

```sh
nvm use            # Node 24
corepack enable    # provides the pnpm version pinned in package.json
pnpm install
pnpm lint           # pnpm check (guardrails) + ESLint
pnpm test
pnpm typecheck
pnpm format:check

pnpm gen:shell intranet
pnpm gen:remote intranet staff-directory
pnpm install
pnpm dev:intranet   # shell on :3100 + every intranet remote
```

| Script                                                   | What                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------ |
| `pnpm gen:shell <zone>`                                  | Create `apps/<zone>/shell-<zone>` (zone: intranet, internet) |
| `pnpm gen:remote <zone> <name> [--private] [--external]` | Create a remote and register it with the zone's shell        |
| `pnpm dev:intranet` / `pnpm dev:internet`                | Shell + remotes of the zone in parallel (Nx, by `zone:` tag) |
| `pnpm check`                                             | Guardrails: dependency tiers, app tags/ports/boundaries      |
| `pnpm lint` / `typecheck` / `test` / `build`             | All projects (Nx)                                            |
| `pnpm e2e` / `pnpm e2e:<zone>`                           | Zone e2e suites (Playwright + axe), one zone at a time       |

Each package has its own `node_modules` (pnpm isolated layout). Add a dependency to the package
that uses it (`pnpm --filter <pkg> add <dep>`). Packages in the catalog are written as `catalog:`.
See `docs/adding-dependencies.md` and `docs/toolchain.md`.
