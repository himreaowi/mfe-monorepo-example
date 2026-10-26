# MFE monorepo example

An example application built from the MFE monorepo template (pnpm workspaces + Nx + webpack 5 +
Module Federation 2): a **Staff Portal** (intranet zone) and a **Citizen Portal** (internet zone).
The apps were created only with the generators (commit "feat(B1): generate …"); everything after
that commit is what a team writes by hand. The template README follows below the example
section.

## The example

| Zone     | App (package)                                                  | Kind                                           | Routes                                             |
| -------- | -------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------- |
| intranet | Staff Portal (`@org/shell-staff`, :3101, at `/`)               | shell (blue header, sidebar nav)               | `/`, 404                                           |
| intranet | Staff directory (`@org/intranet-staff-directory`, :3110)       | public remote                                  | `/staff-directory`, `/staff-directory/<id>`        |
| intranet | Leave (`@org/intranet-leave-requests`, :3111)                  | public remote                                  | `/leave-requests`, `/leave-requests/new`           |
| intranet | IT helpdesk (`@org/intranet-it-helpdesk`, :3112)               | external adapter (esm vendor)                  | `/it-helpdesk`, `…/new`, `…/tickets/<id>` (vendor) |
| internet | Citizen Portal (`@org/shell-citizen`, :3201, at `/citizen`)    | shell (default header, top nav, Singpass mock) | `/citizen/`, 404; `/` redirects here               |
| internet | Business Portal (`@org/shell-business`, :3202, at `/business`) | shell (sidebar nav, Corppass mock)             | `/business/`, 404                                  |
| internet | Services (`@org/internet-services`, :3210)                     | public remote (citizen)                        | `/services`, `/services/<slug>`                    |
| internet | Announcements (`@org/internet-announcements`, :3211)           | public remote (citizen + business)             | `/announcements`, `/announcements/<id>`            |
| internet | My profile (`@org/internet-my-profile`, :3212)                 | private remote (citizen)                       | `/my-profile`                                      |
| internet | Payments (`@org/internet-payments`, :3213)                     | external adapter (web component vendor)        | `/payments`, `/payments/receipt/<ref>` (vendor)    |
| internet | Business licences (`@org/internet-business-licences`, :3214)   | private remote (business)                      | `/business-licences`, `/business-licences/<id>`    |

Apps are grouped by shell (`pnpm check` rule `remote-location`; `pnpm move-remote` moves a remote):

```
apps/intranet/staff/{shell, staff-directory, leave-requests, it-helpdesk}
apps/internet/citizen/{shell, services, payments, my-profile}
apps/internet/business/{shell, business-licences}
apps/internet/shared/announcements          (listed by citizen and business)
```

Remote routes are below each shell's base path: `/citizen/announcements`, `/business/announcements`.

### The three portals

| Portal          | URL (after `pnpm dev:<zone>`)  | Zone     | Sign-in (dev mock, "Sign in" button)                                  |
| --------------- | ------------------------------ | -------- | --------------------------------------------------------------------- |
| Staff Portal    | http://localhost:3100/         | intranet | `Dev User (mock)`, role `user` (the template default)                 |
| Citizen Portal  | http://localhost:3200/citizen  | internet | `Dev User (mock)`, role `user` (the template default, Singpass-style) |
| Business Portal | http://localhost:3200/business | internet | `Lim Wei Ling (Acme Trading Pte Ltd)`, role `business-admin`          |

The internet zone is one origin: `http://localhost:3200/` redirects to the Citizen Portal. Each
portal keeps its own session. Private pages (Leave requests, My profile, Business licences)
ask for the sign-in first.

```sh
nvm use && corepack enable && pnpm install
pnpm dev:intranet     # Staff Portal  http://localhost:3100 (+ mock API :3190, example vendor :3192)
pnpm dev:internet     # http://localhost:3200: Citizen Portal /citizen/, Business Portal /business/ (+ mock API :3290, example vendor :3292)
pnpm storybook        # @org/ui component library, http://localhost:3193 (stop with Ctrl-C)
pnpm e2e              # every shell (Staff, Citizen, Business), one after the other: feature specs + generated specs + axe (light + dark)
```

Both portals can run at the same time (two terminals): every zone has its own port range,
dev tools included. `pnpm dev:<zone>` is the template's launcher (`tools/scripts/bin/dev.js`):
Ctrl-C stops every dev server of the zone and frees its ports. "Sign in" uses the template's dev
mock, per shell: the Citizen Portal signs in the default (Singpass-style) mock user, the Business
Portal a Corppass-style business user (`mfe.devManifest.auth.mockUser` in
`apps/internet/business/shell/package.json`), each with its own session.

| Zone     | Dev proxy | Shells     | Remotes   | Dev tools (root `package.json` `mfe.tools`, read with `toolPort`)                                  |
| -------- | --------- | ---------- | --------- | -------------------------------------------------------------------------------------------------- |
| intranet | 3100      | 3101       | 3110–3112 | 3190 mock API (`tools/mock-api`), 3192 Acme Service Desk (`tools/example-vendors`), 3193 Storybook |
| internet | 3200      | 3201, 3202 | 3210–3214 | 3290 mock API, 3292 Bright Payments                                                                |

The internet zone has two shells on one origin: `/` redirects to the Citizen Portal (root
`package.json` `mfe.zones.internet.defaultShell`).

### What was added by hand

| Where                                                    | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`tools/mock-api`](tools/mock-api)                       | the template's per-zone mock API, extended with the example's domain endpoints (`src/intranet.js`: staff, leave, helpdesk; `src/internet.js`: services, announcements, profile). Apps read its URL from `settings.apiBaseUrl` in the shell's generated `mfe-manifest.dev.json` (from the shell's `package.json` `mfe.devManifest`); every app's `nx.targets.dev.dependsOn` starts it (`serve:<zone>`)                                                                                                                                                                                                                                            |
| [`tools/example-vendors`](tools/example-vendors)         | two fictional vendor products without React on versioned URLs, one server per zone serving only that zone's vendor: Acme Service Desk (esm, intranet) and Bright Payments (web component, internet), configured through `props.vendor` in the manifest. They replace the template's mock vendor in this example                                                                                                                                                                                                                                                                                                                                  |
| [`packages/platform/use-api`](packages/platform/use-api) | `useApi` / `useSubmit` hooks used by every React remote: code shared through `packages/`, never between apps. Intranet and internet share no remotes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `apps/*/*/src/features/*`                                | the features (types → api → hooks → UI), pages and routes; pages call the features' data hooks and pass the data down, components only display (`docs/coding-conventions.md` "Data fetching"). The Staff directory's filters are the state-pattern example: a pure reducer + Context in `features/staff/state/`, stored in the URL (`?q=&department=`). Unit tests next to the code (API tests with `@org/jest-config/fetch`, hook tests with the api module mocked, components with props). Forms follow the template's pattern: validate on submit, focused error summary, field errors, server 422 mapped, submit disabled only while sending |
| `apps/<zone>/shell-<zone>`                               | branding (`APP_TITLE`, page title), home page cards (`description` in `remotes.json`), feature e2e specs in `e2e/`. each shell owns its layout (`src/layouts/ShellLayout/`, copied from a template starter: Staff Portal from `side` with its blue colours in `ShellLayout.module.scss`, Citizen Portal from `top` with the default colours); the `@org/ui` building blocks keep the header one row (Menu button when it does not fit)                                                                                                                                                                                                           |

The generated e2e specs run unchanged. For the external adapters the generic vendor test
(mounted content, no fallback, no console errors, unmount) runs against the example vendors;
the template's mock-vendor-only test skips with the vendor URL as the reason, and the feature
specs (`it-helpdesk.spec.ts`, `payments.spec.ts`) cover vendor routing, events and the theme.

### Dependency tier 3 (decision D4): date-fns in one remote

The leave form counts working days with **date-fns**, used only by the Leave remote:

```sh
pnpm --filter @org/intranet-leave-requests add date-fns
```

`catalogMode: manual` wrote a normal range (`"date-fns": "^4.4.0"`) into
`apps/intranet/staff/leave-requests/package.json` only: no catalog entry, no exception, `pnpm check`
stays green. If a second app needed date-fns, `pnpm check` would fail with
`shared-not-in-catalog` until it moves to the catalog (tier 2,
[docs/adding-dependencies.md](docs/adding-dependencies.md)). Display-only dates elsewhere use
`Intl.DateTimeFormat`.

### Keeping up with the template

This repository started from the template and keeps its history, so template fixes come in
with a normal merge (`git remote add template <url>`, `git fetch template`,
`git merge template/main`): shared `packages/`, `tools/` and `docs/` take the template's
version, the example's apps and features stay. The example changes no shared tool code: its
extra dev-tool server is declared in the root `package.json` (`mfe.tools.exampleVendors`,
offset 2; [docs/architecture.md](docs/architecture.md#adding-a-dev-tool-server)). The template's
`mockVendor` entry (offset 1) stays reserved although the example's adapters use the example
vendors.

---

## Template README

Template monorepo for **React microfrontends**: pnpm workspaces + Nx (package-based), webpack 5 +
Module Federation 2, React 19, TypeScript. Two zones (intranet, internet), each with one or more shells
(each under its own base path, e.g. `/citizen` and `/business`) that load their remotes at
runtime from a per-environment manifest. Shared UI, auth (BFF
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
pnpm dev:intranet          # http://localhost:3100 (the zone's dev proxy)
pnpm e2e:intranet          # e2e + axe WCAG 2.2 AA (after: pnpm --filter @org/shell-staff exec playwright install chromium)
```

## What changed in v3

- **Remote wiring is five files** (`package.json`, `webpack.config.js`, `src/main.tsx`,
  `src/app/apps.tsx`, `src/app/routes.tsx`): Module Federation async startup (no `bootstrap.tsx`),
  `useApiClient()` from `@org/mf-runtime` (no `services/http.ts`), no per-component `index.ts`
  ([coding conventions](docs/coding-conventions.md), [adding an app](docs/adding-an-app.md)).
- **Page-level data fetching** and a React Context + reducer state pattern (`state/`, shareable
  filters in the URL); readable CSS Module class names `Component_class__hash`
  ([coding conventions](docs/coding-conventions.md)).
- **Many shells per zone** under base paths, a zone port plan (proxy x00, shells x01-x09, remotes
  x10-x89, tools x90-x99) and a zone dev proxy (`pnpm gen:shell`, `pnpm gen:remote --shell`;
  [architecture](docs/architecture.md), [adding an app](docs/adding-an-app.md)).
- **Same-origin `<base>/api` and `<base>/auth` proxy**, manifest generated at container start from
  variables, `.env` files per zone/shell, `.env.example`, check-env
  ([configuration](docs/configuration.md), [DevOps handoff](docs/devops-handoff.md)).
- **webpack 5 replaces Rspack** (Module Federation 2 and `remoteCssPlugin` kept;
  [toolchain](docs/toolchain.md)).
- **`@org/ui` component library** (forms, Dialog, Table, Tabs, ...) with Storybook 10, `pnpm test:ui`
  and the `ui-component-files` / `shared-component` check rules
  ([UI context](docs/ui-context.md), [guardrails](docs/guardrails.md)).
- **Libraries for shared business code**: `apps/<zone>/libs/<capability>` (one zone) and
  `packages/common/<capability>` (both zones, public), `pnpm gen:package`, `pnpm move-component`
  and the folder-derived `package-boundaries` rule ([where code goes](docs/where-code-goes.md)).

## Documentation

| Doc                                                                                         | For                                                                   |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| [Configuration](docs/configuration.md)                                                      | variables, `.env` files, same-origin `/api` and `/auth` proxy         |
| [Getting started](docs/getting-started.md)                                                  | clone → install → generate → run → test → build                       |
| [Architecture](docs/architecture.md)                                                        | decisions D1–D8, runtime (manifest → remotes), zones, auth, vendors   |
| [Adding an app](docs/adding-an-app.md)                                                      | generators, what they change, going to production                     |
| [Adding dependencies](docs/adding-dependencies.md)                                          | dependency tiers: catalog, app-local, exceptions                      |
| [Where code goes](docs/where-code-goes.md)                                                  | remote, `@org/ui`, zone library or `packages/common`; import table    |
| [Coding conventions](docs/coding-conventions.md)                                            | where code goes, data fetching, React/TS rules                        |
| [UI context](docs/ui-context.md)                                                            | tokens, theming, components, a11y rules for UI work                   |
| [Testing](docs/testing.md)                                                                  | unit, contract, e2e, accessibility; how CI runs them                  |
| [Guardrails](docs/guardrails.md)                                                            | every `pnpm check` / boundary rule and its fix                        |
| [Auth contract](docs/auth-contract.md)                                                      | BFF endpoints, cookies, CSRF, CORS (for the backend team)             |
| [External modules](docs/external-modules.md)                                                | vendor / other-framework integration, mount contract, vendor kit      |
| [DevOps handoff](docs/devops-handoff.md)                                                    | Azure DevOps pipeline, affected matrix, nginx/Docker, manifest, CSP   |
| [Toolchain](docs/toolchain.md)                                                              | pinned versions, verified gotchas                                     |
| [Diagrams](docs/diagrams/README.md)                                                         | runtime, repo layers, new project: PNG/SVG/HTML and how to regenerate |
| [Project overview](docs/project-overview.md)                                                | your product (template to fill in)                                    |
| Contracts: [theming](docs/contracts/theming.md), [WCAG 2.2 AA](docs/contracts/a11y-wcag.md) | normative UI rules                                                    |
| [AGENTS.md](AGENTS.md), [constitution](.specify/memory/constitution.md)                     | AI agents checklist, engineering principles (Spec Kit)                |

## Commands

| Command                                                                                                                         | What                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm gen:shell <zone> [<name>] [--base-path /<path>] [--layout top\|side] [--title "<text>"]`                                  | create `apps/<zone>/<name>/shell` (default name: the zone; zone: `intranet`, `internet`; `--base-path`: where it is served, several shells per zone; `--layout`: starter layout copied into the shell)        |
| `pnpm gen:remote <zone> <name> [--shell <s>[,<s>]] [--private] [--state] [--external [--vendor-format <f>]] [--title "<text>"]` | create a remote and register it with the zone's shell, or the `--shell`s named (required with several shells; `--state`: feature-state example)                                                               |
| `pnpm move-remote <zone> <remote> --to shared\|<shell> [--dry-run]`                                                             | move a remote to the folder `pnpm check` expects (`git mv`, path references, `pnpm install`, `pnpm check`)                                                                                                    |
| `pnpm gen:package <common\|zone> <capability>`                                                                                  | create a library: `packages/common/<capability>` (both zones, public) or `apps/<zone>/libs/<capability>`                                                                                                      |
| `pnpm move-component <app> <Component> --to <zone>/libs/<cap>\|common/<cap> [--dry-run]`                                        | move a component from an app into a library (exports, dependency, imports, check)                                                                                                                             |
| `pnpm dev:intranet` / `pnpm dev:internet`                                                                                       | every shell + remote of the zone + its mock API (+ mock vendor), all shells on the zone port (3100 / 3200) through a dev proxy; both zones can run at once; Ctrl-C stops all with one line                    |
| `pnpm check`                                                                                                                    | guardrails: dependency tiers, app metadata, cross-app imports                                                                                                                                                 |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build`                                                                     | all projects (Nx, cached)                                                                                                                                                                                     |
| `pnpm e2e` / `pnpm e2e:<zone>`                                                                                                  | zone e2e suites (Playwright + axe, light + dark, desktop + 375 px)                                                                                                                                            |
| `pnpm -s apps [--zone=<z>] [--affected --base=<sha>] [--json\|--matrix]`                                                        | apps as data for CI matrices                                                                                                                                                                                  |
| `pnpm -s validate-manifest <file> [--zone=<z>]`                                                                                 | check a per-environment `mfe-manifest.json`                                                                                                                                                                   |
| `pnpm dev-manifest`                                                                                                             | regenerate each shell's `mfe-manifest.dev.json` from `remotes.json`, the remotes' ports and the shell's `mfe.devManifest` (dev scripts, `pnpm e2e` and the generators also do; `pnpm check` fails when stale) |
| `pnpm storybook` / `pnpm build-storybook`                                                                                       | Storybook 10 of `@org/ui` (dev only, tools port :3193); static build to `packages/platform/ui/storybook-static`                                                                                               |
| `pnpm test:ui` / `pnpm test:ui:update`                                                                                          | `@org/ui` axe (WCAG 2.2 AA) + screenshot tests of every story, light and dark                                                                                                                                 |
| `pnpm format` / `pnpm format:check`                                                                                             | Prettier                                                                                                                                                                                                      |

## Layout

| Path                                                                                       | Contents                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/<zone>/<shell>/shell`, `apps/<zone>/<shell>/<remote>`, `apps/<zone>/shared/<remote>` | apps, created by the generators, grouped by shell: a remote listed by one shell sits in that shell's folder, one listed by 2+ shells in `shared/` (`pnpm check` rule `remote-location`, `pnpm move-remote`); each shell holds its zone's e2e suite (`e2e/`)                   |
| `apps/<zone>/libs/<capability>`                                                            | code shared by one zone's apps (`@org/<zone>-<capability>`), never deployed alone                                                                                                                                                                                             |
| `packages/common/<capability>`                                                             | business logic for both zones (`@org/common-<capability>`); public: ships to the internet portals                                                                                                                                                                             |
| [`packages/platform/ui`](packages/platform/ui)                                             | `@org/ui`: component library (Button, Link, form fields, Dialog, Alert, Card, Table, Tabs, ...; Storybook) and building blocks (ThemeToggle, SkipLink, Brand, useMenuDisclosure, useFitLayout, RemoteFallback, ConnectionRequired, ThemeProvider); each shell owns its layout |
| [`packages/platform/design-tokens`](packages/platform/design-tokens)                       | `@org/design-tokens`: CSS variables (light/dark), global styles, theme constants                                                                                                                                                                                              |
| [`packages/platform/mf-runtime`](packages/platform/mf-runtime)                             | `@org/mf-runtime`: manifest loader + schema, `initRemotes`, `<RemoteApp>`, remote helpers, mount contract + `<ExternalModule>`                                                                                                                                                |
| [`packages/platform/auth`](packages/platform/auth)                                         | `@org/auth`: AuthProvider, useAuth, RequireAuth, UserMenu, BFF session client, dev mock                                                                                                                                                                                       |
| [`packages/platform/http-client`](packages/platform/http-client)                           | `@org/http-client`: fetch wrapper, runtime base URL, apiRoutes pattern                                                                                                                                                                                                        |
| [`packages/platform/pwa`](packages/platform/pwa)                                           | `@org/pwa`: registerPwa, useOnlineStatus, Workbox build plugin                                                                                                                                                                                                                |
| [`packages/platform/webpack-config`](packages/platform/webpack-config)                     | `@org/webpack-config`: createShellConfig / createRemoteConfig (webpack + MF 2, tier-1 singletons)                                                                                                                                                                             |
| [`packages/platform/jest-config`](packages/platform/jest-config)                           | `@org/jest-config`: Jest 30 preset (jsdom, SWC, Testing Library)                                                                                                                                                                                                              |
| [`packages/platform/playwright-config`](packages/platform/playwright-config)               | `@org/playwright-config`: zone e2e config, console-error fixture, axe WCAG 2.2 AA helper                                                                                                                                                                                      |
| `packages/platform/eslint-config`, `prettier-config`, `tsconfig`                           | shared lint/format/TS configs (incl. Nx module boundaries)                                                                                                                                                                                                                    |
| [`packages/platform/vendor-kit`](packages/platform/vendor-kit)                             | what vendors get: contract types, test host, examples, checklist (zip)                                                                                                                                                                                                        |
| [`tools/generators`](tools/generators)                                                     | `gen:shell`, `gen:remote` and their templates                                                                                                                                                                                                                                 |
| [`tools/scripts`](tools/scripts)                                                           | `check`, `apps`, `e2e`, `validate-manifest`, `mfe-preview`                                                                                                                                                                                                                    |
| [`tools/mock-vendor`](tools/mock-vendor)                                                   | dev-only mock vendor module (no React), one per zone (:3191 / :3291)                                                                                                                                                                                                          |
| [`tools/mock-api`](tools/mock-api)                                                         | dev-only mock JSON API, one per zone (:3190 / :3290), reached through the dev proxy's same-origin `<base>/api`                                                                                                                                                                |
| [`deploy/`](deploy)                                                                        | shared nginx template, Dockerfile (one image per app), example per-environment manifest                                                                                                                                                                                       |
| `pnpm-workspace.yaml`, `version-exceptions.json`, `nx.json`                                | workspaces + catalog (one version per core library), justified exceptions, Nx task defaults                                                                                                                                                                                   |
| `.specify/`, `.cursor/skills/`, `specs/`                                                   | Spec Kit (constitution, templates, scripts) and its agent skills; feature specs go in `specs/`                                                                                                                                                                                |

Each package has its own `node_modules` (pnpm isolated layout). Add a dependency to the package
that uses it (`pnpm --filter <pkg> add <dep>`); catalog packages are written as `catalog:`.
