# MFE monorepo example

An example application built from the MFE monorepo template (pnpm workspaces + Nx + Rspack +
Module Federation 2): a **Staff Portal** (intranet zone) and a **Citizen Portal** (internet zone).
The apps were created only with the generators (commit "feat(B1): generate …"); everything after
that commit is what a team writes by hand. The template README follows below the example
section.

## The example

| Zone     | App (package)                                            | Kind                                    | Routes                                             |
| -------- | -------------------------------------------------------- | --------------------------------------- | -------------------------------------------------- |
| intranet | Staff Portal (`@org/shell-intranet`, :3100)              | shell                                   | `/`, 404                                           |
| intranet | Staff directory (`@org/intranet-staff-directory`, :3101) | public remote                           | `/staff-directory`, `/staff-directory/<id>`        |
| intranet | Leave (`@org/intranet-leave-requests`, :3102)            | public remote                           | `/leave-requests`, `/leave-requests/new`           |
| intranet | IT helpdesk (`@org/intranet-it-helpdesk`, :3103)         | external adapter (esm vendor)           | `/it-helpdesk`, `…/new`, `…/tickets/<id>` (vendor) |
| internet | Citizen Portal (`@org/shell-internet`, :3200)            | shell                                   | `/`, 404                                           |
| internet | Services (`@org/internet-services`, :3201)               | public remote                           | `/services`, `/services/<slug>`                    |
| internet | Announcements (`@org/internet-announcements`, :3202)     | public remote                           | `/announcements`, `/announcements/<id>`            |
| internet | My profile (`@org/internet-my-profile`, :3203)           | private remote (sign-in)                | `/my-profile`                                      |
| internet | Payments (`@org/internet-payments`, :3204)               | external adapter (web component vendor) | `/payments`, `/payments/receipt/<ref>` (vendor)    |

```sh
nvm use && corepack enable && pnpm install
pnpm dev:intranet     # http://localhost:3100 (+ mock API :3910, example vendors :3990)
pnpm dev:internet     # http://localhost:3200 (+ mock API :3920, example vendors :3990)
pnpm e2e              # both zones: feature specs + generated specs + axe (light + dark)
```

"Sign in" uses the template's dev mock. Run one zone at a time (both use the vendor port 3990).

### What was added by hand

| Where                                            | What                                                                                                                                                                                                      |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`tools/mock-api`](tools/mock-api)               | dev-only JSON API per zone (intranet :3910, internet :3920). Apps read the base URL from `settings.apiBaseUrl` in the shell's `mfe-manifest.dev.json`; started by the remotes' `nx.targets.dev.dependsOn` |
| [`tools/example-vendors`](tools/example-vendors) | two fictional vendor products without React on versioned URLs: Acme Service Desk (esm) and Bright Payments (web component), configured through `props.vendor` in the manifest                             |
| [`packages/use-api`](packages/use-api)           | `useApi` / `useSubmit` hooks used by every React remote: code shared through `packages/`, never between apps. Intranet and internet share no remotes                                                      |
| `apps/*/*/src/features/*`                        | the features (types → api → hooks → UI), pages and routes; unit tests next to the code                                                                                                                    |
| `apps/<zone>/shell-<zone>`                       | branding, home page cards (`description` in `remotes.json`), a "Menu" disclosure for the nav below 40rem, feature e2e specs in `e2e/`                                                                     |

### Dependency tier 3 (decision D4): date-fns in one remote

The leave form counts working days with **date-fns**, used only by the Leave remote:

```sh
pnpm --filter @org/intranet-leave-requests add date-fns
```

`catalogMode: manual` wrote a normal range (`"date-fns": "^4.4.0"`) into
`apps/intranet/leave-requests/package.json` only: no catalog entry, no exception, `pnpm check`
stays green. If a second app needed date-fns, `pnpm check` would fail with
`shared-not-in-catalog` until it moves to the catalog (tier 2,
[docs/adding-dependencies.md](docs/adding-dependencies.md)). Display-only dates elsewhere use
`Intl.DateTimeFormat`.

### Changes to template code in this copy (template follow-ups)

- `packages/http-client`: `HttpClientError.body` keeps the parsed JSON of an error response, so
  422 field errors can reach the form.
- `packages/ui` `MainLayout`: tighter header spacing below 40rem (with the shells' "Menu" nav the
  header stays short at 375 px).

---

## Template README

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

| Command                                                                                           | What                                                                                        |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `pnpm gen:shell <zone> [--title "<text>"]`                                                        | create `apps/<zone>/shell-<zone>` (zone: `intranet`, `internet`)                            |
| `pnpm gen:remote <zone> <name> [--private] [--external [--vendor-format <f>]] [--title "<text>"]` | create a remote and register it with the zone's shell                                       |
| `pnpm dev:intranet` / `pnpm dev:internet`                                                         | shell + every remote of the zone + its mock API (+ mock vendor); both zones can run at once |
| `pnpm check`                                                                                      | guardrails: dependency tiers, app metadata, cross-app imports                               |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build`                                       | all projects (Nx, cached)                                                                   |
| `pnpm e2e` / `pnpm e2e:<zone>`                                                                    | zone e2e suites (Playwright + axe, light + dark, desktop + 375 px)                          |
| `pnpm -s apps [--zone=<z>] [--affected --base=<sha>] [--json\|--matrix]`                          | apps as data for CI matrices                                                                |
| `pnpm -s validate-manifest <file> [--zone=<z>]`                                                   | check a per-environment `mfe-manifest.json`                                                 |
| `pnpm format` / `pnpm format:check`                                                               | Prettier                                                                                    |

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
