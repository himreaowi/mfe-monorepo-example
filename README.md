# mfe-monorepo-template

Template monorepo for **React microfrontends**: pnpm workspaces + Nx (package-based), Rspack +
Module Federation 2, React 19, TypeScript. Two zones (intranet, internet), each with one shell
that loads its remotes at runtime from a per-environment manifest. Shared UI, auth (BFF
pattern), runtime glue, build/test configs and guardrails live in `packages/`; apps are created
with generators.

`apps/` is empty in the template. Start with [docs/getting-started.md](docs/getting-started.md).

## Quick start

```sh
nvm use && corepack enable && pnpm install
pnpm gen:shell intranet
pnpm gen:remote intranet staff-directory
pnpm gen:remote intranet leave-requests --private
pnpm install
pnpm dev:intranet          # http://localhost:3100
pnpm e2e:intranet          # e2e + axe WCAG 2.2 AA (after: pnpm --filter @org/shell-intranet exec playwright install chromium)
```

## Documentation

| Doc                                                                                         | For                                                                 |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| [Getting started](docs/getting-started.md)                                                  | clone → install → generate → run → test → build                     |
| [Architecture](docs/architecture.md)                                                        | decisions D1–D8, runtime (manifest → remotes), zones, auth, vendors |
| [Adding an app](docs/adding-an-app.md)                                                      | generators, what they change, going to production                   |
| [Adding dependencies](docs/adding-dependencies.md)                                          | dependency tiers: catalog, app-local, exceptions                    |
| [Coding conventions](docs/coding-conventions.md)                                            | where code goes, data fetching, React/TS rules                      |
| [UI context](docs/ui-context.md)                                                            | tokens, theming, components, a11y rules for UI work                 |
| [Testing](docs/testing.md)                                                                  | unit, contract, e2e, accessibility; how CI runs them                |
| [Guardrails](docs/guardrails.md)                                                            | every `pnpm check` / boundary rule and its fix                      |
| [Auth contract](docs/auth-contract.md)                                                      | BFF endpoints, cookies, CSRF, CORS (for the backend team)           |
| [External modules](docs/external-modules.md)                                                | vendor / other-framework integration, mount contract, vendor kit    |
| [DevOps handoff](docs/devops-handoff.md)                                                    | Azure DevOps pipeline, affected matrix, nginx/Docker, manifest, CSP |
| [Toolchain](docs/toolchain.md)                                                              | pinned versions, verified gotchas                                   |
| [Project overview](docs/project-overview.md)                                                | your product (template to fill in)                                  |
| Contracts: [theming](docs/contracts/theming.md), [WCAG 2.2 AA](docs/contracts/a11y-wcag.md) | normative UI rules                                                  |
| [AGENTS.md](AGENTS.md), [constitution](.specify/memory/constitution.md)                     | AI agents checklist, engineering principles (Spec Kit)              |

## Commands

| Command                                                                                           | What                                                                                                                        |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `pnpm gen:shell <zone> [--title "<text>"]`                                                        | create `apps/<zone>/shell-<zone>` (zone: `intranet`, `internet`)                                                            |
| `pnpm gen:remote <zone> <name> [--private] [--external [--vendor-format <f>]] [--title "<text>"]` | create a remote and register it with the zone's shell                                                                       |
| `pnpm dev:intranet` / `pnpm dev:internet`                                                         | shell + every remote of the zone + its mock API (+ mock vendor); both zones can run at once; Ctrl-C stops all with one line |
| `pnpm check`                                                                                      | guardrails: dependency tiers, app metadata, cross-app imports                                                               |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build`                                       | all projects (Nx, cached)                                                                                                   |
| `pnpm e2e` / `pnpm e2e:<zone>`                                                                    | zone e2e suites (Playwright + axe, light + dark, desktop + 375 px)                                                          |
| `pnpm -s apps [--zone=<z>] [--affected --base=<sha>] [--json\|--matrix]`                          | apps as data for CI matrices                                                                                                |
| `pnpm -s validate-manifest <file> [--zone=<z>]`                                                   | check a per-environment `mfe-manifest.json`                                                                                 |
| `pnpm format` / `pnpm format:check`                                                               | Prettier                                                                                                                    |

## Layout

| Path                                                        | Contents                                                                                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `apps/<zone>/<name>`                                        | apps, created by the generators; each shell holds its zone's e2e suite (`e2e/`)                                                |
| [`packages/ui`](packages/ui)                                | `@org/ui`: Button, ThemeToggle, MainLayout, RemoteFallback, ConnectionRequired, ThemeProvider                                  |
| [`packages/design-tokens`](packages/design-tokens)          | `@org/design-tokens`: CSS variables (light/dark), global styles, theme constants                                               |
| [`packages/mf-runtime`](packages/mf-runtime)                | `@org/mf-runtime`: manifest loader + schema, `initRemotes`, `<RemoteApp>`, remote helpers, mount contract + `<ExternalModule>` |
| [`packages/auth`](packages/auth)                            | `@org/auth`: AuthProvider, useAuth, RequireAuth, UserMenu, BFF session client, dev mock                                        |
| [`packages/http-client`](packages/http-client)              | `@org/http-client`: fetch wrapper, runtime base URL, apiRoutes pattern                                                         |
| [`packages/pwa`](packages/pwa)                              | `@org/pwa`: registerPwa, useOnlineStatus, Workbox build plugin                                                                 |
| [`packages/rspack-config`](packages/rspack-config)          | `@org/rspack-config`: createShellConfig / createRemoteConfig (Rspack + MF 2, tier-1 singletons)                                |
| [`packages/jest-config`](packages/jest-config)              | `@org/jest-config`: Jest 30 preset (jsdom, SWC, Testing Library)                                                               |
| [`packages/playwright-config`](packages/playwright-config)  | `@org/playwright-config`: zone e2e config, console-error fixture, axe WCAG 2.2 AA helper                                       |
| `packages/eslint-config`, `prettier-config`, `tsconfig`     | shared lint/format/TS configs (incl. Nx module boundaries)                                                                     |
| [`packages/vendor-kit`](packages/vendor-kit)                | what vendors get: contract types, test host, examples, checklist (zip)                                                         |
| [`tools/generators`](tools/generators)                      | `gen:shell`, `gen:remote` and their templates                                                                                  |
| [`tools/scripts`](tools/scripts)                            | `check`, `apps`, `e2e`, `validate-manifest`, `mfe-preview`                                                                     |
| [`tools/mock-vendor`](tools/mock-vendor)                    | dev-only mock vendor module (no React), one per zone (:3191 / :3291)                                                           |
| [`tools/mock-api`](tools/mock-api)                          | dev-only mock JSON API, one per zone (:3190 / :3290), `settings.apiBaseUrl` of the dev manifests                               |
| [`deploy/`](deploy)                                         | shared nginx template, Dockerfile (one image per app), example per-environment manifest                                        |
| `pnpm-workspace.yaml`, `version-exceptions.json`, `nx.json` | workspaces + catalog (one version per core library), justified exceptions, Nx task defaults                                    |
| `.specify/`, `.cursor/skills/`, `specs/`                    | Spec Kit (constitution, templates, scripts) and its agent skills; feature specs go in `specs/`                                 |

Each package has its own `node_modules` (pnpm isolated layout). Add a dependency to the package
that uses it (`pnpm --filter <pkg> add <dep>`); catalog packages are written as `catalog:`.
