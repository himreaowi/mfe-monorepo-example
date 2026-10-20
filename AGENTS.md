# AGENTS.md

Instructions for AI coding agents (and humans) working in this monorepo. Details live in
`docs/`; on conflict with generic React or agent advice, the repo docs win.

## Before changing code

1. [docs/architecture.md](docs/architecture.md): zones, shells vs remotes, runtime manifest,
   decisions D1–D8.
2. [docs/coding-conventions.md](docs/coding-conventions.md): where code goes, data fetching,
   state management.
3. [docs/ui-context.md](docs/ui-context.md) before UI, token, theme or component work.
4. [docs/project-overview.md](docs/project-overview.md) for product intent;
   [.specify/memory/constitution.md](.specify/memory/constitution.md) for principles.
5. Match existing patterns: the generated apps (`tools/generators/templates/`) and
   `packages/*`.

## Must follow

- Create apps only with `pnpm gen:shell <zone> [<name>] [--base-path /x] [--layout top|side]`
  (a zone may have several shells, each under its own base path) / `pnpm gen:remote <zone> <name>
[--shell <s>] [--private] [--state] [--external [--vendor-format esm|web-component|script]]
[--title "<text>"]` (`--shell` is required when the zone has several shells), then
  `pnpm install`. Never copy an app folder.
- A shell never imports a remote; a remote never imports another remote or a shell; zones
  (intranet, internet) share only `packages/*`. Shared code → a package in `packages/`.
- Dependencies: add to the package that uses it (`pnpm --filter <pkg> add <dep>`). Catalog
  packages use `catalog:`; a library used by 2+ packages goes into the catalog; tier-1
  (`react`, `react-dom`, `react-router`, `@org/ui`, `@org/auth`) never differs. See
  [docs/adding-dependencies.md](docs/adding-dependencies.md). Never hand-edit `pnpm-lock.yaml`.
- No environment URLs or config in code or build: runtime config comes from
  `mfe-manifest.json` (`settings`, remote `props`), which the image generates at start from
  variables ([docs/configuration.md](docs/configuration.md)). The API is the relative
  same-origin `<base>/api` (never an absolute `apiBaseUrl`); use `useApiClient()` from
  `@org/mf-runtime`, no per-app `services/http.ts`. No tokens or secrets in the browser (BFF
  pattern, [docs/auth-contract.md](docs/auth-contract.md)).
- Remotes: five wiring files only (`package.json`, `webpack.config.js`, `src/main.tsx`,
  `src/app/apps.tsx`, `src/app/routes.tsx`; async startup is Module Federation's, no `bootstrap.tsx`);
  the exposed `src/app/apps.tsx` (and what it imports) must not import global styles or register a
  service worker; links use `useRemotePath()`; keep standalone mode working.
- No hardcoded API or app paths in components (`apiRoutes`, `routePaths`); no API calls in
  component `useEffect` (use `features/*/api` + `features/*/hooks`). Fetching is page-level: pages
  call the data hooks and pass data down; feature components only display. Shared UI state: React
  Context + reducer in `state/`, shareable filters in the URL
  ([docs/coding-conventions.md](docs/coding-conventions.md#data-fetching)).
- One folder per component: `features/<feature>/components/<Name>/` (and `src/components/<Name>/`)
  with `<Name>.tsx`, its own `<Name>.module.scss` (never shared between components),
  `<Name>.test.tsx`, no `index.ts` (import the file: `@/components/Card/Card`; the only barrel is
  a feature's public `features/<feature>/index.ts`); private sub-parts in the same folder; shared test data in
  `features/<feature>/__fixtures__/`; helpers in `utils/`
  ([docs/coding-conventions.md](docs/coding-conventions.md#one-folder-per-component)).
  `pnpm check` reports violations.
- Use `@org/ui` components (Storybook: `pnpm storybook`; `pnpm test:ui` = axe + screenshots) before
  writing your own; `pnpm check` enforces the `@org/ui` component folder rule and the shared-component rule.
- Tokens (`var(--…)`) over hardcoded colours/spacing; WCAG 2.2 AA in light and dark; works at
  375 px (the shell's own `src/layouts/ShellLayout` keeps the header one row and collapses it when
  it does not fit, with `useFitLayout` / `useMenuDisclosure` from `@org/ui`; remotes build no menus).
- The shell owns its layout: restyle or restructure it in `src/layouts/ShellLayout/` (colours in
  `ShellLayout.module.scss`), never by adding options to `@org/ui` (a change there rebuilds every
  app). Remotes never set page-wide custom properties (`:root`, `html`, `[data-theme]`).
- Forms validate on submit with an error summary + field errors; submit is disabled only while
  sending ([docs/coding-conventions.md](docs/coding-conventions.md)).
- Dev ports per zone (intranet 31xx, internet 32xx): proxy x00 (`pnpm dev:<zone>`, serves every shell
  under its base path), shells x01–x09, remotes x10–x89, tools x90–x99 (mock API, mock vendor,
  Storybook), assigned in the root `package.json` `mfe.tools` (new tool server:
  [docs/architecture.md](docs/architecture.md#adding-a-dev-tool-server)). Mock endpoints go into
  `tools/mock-api`.
- Tests with the change: unit tests next to the code (every component has one); flows in the zone's
  `apps/<zone>/shell-<name>/e2e/`. Import `test`/`expect` from `@org/playwright-config/test`.
- Done means green: `pnpm check && pnpm lint && pnpm typecheck && pnpm test` (+ `pnpm build`
  and `pnpm e2e:<zone>` when apps changed) and `pnpm format:check`.
- Do not disable guardrails, lint rules or axe rules to get green; fix the cause or ask.
- Do not commit or push unless asked. Never commit secrets.

## Quick pointers

| Concern                       | Location                                                                                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Generators + templates        | `tools/generators/`                                                                                                                                 |
| Guardrails (`pnpm check`)     | `tools/scripts/src/check-*.js`, [docs/guardrails.md](docs/guardrails.md)                                                                            |
| Shell registry / dev manifest | `apps/<zone>/shell-<name>/remotes.json`; `mfe-manifest.dev.json` is generated (`pnpm dev-manifest`) from it + ports + the shell's `mfe.devManifest` |
| Manifest schema               | `packages/mf-runtime/src/manifest/mfe-manifest.schema.json`                                                                                         |
| Host props (remote side)      | `@org/mf-runtime/remote` (`useHostProps`, `useRemotePath`, `createRemoteApp`)                                                                       |
| Auth                          | `@org/auth`, [docs/auth-contract.md](docs/auth-contract.md)                                                                                         |
| Vendor modules                | `@org/mf-runtime/external`, [docs/external-modules.md](docs/external-modules.md)                                                                    |
| Dev mocks (per zone)          | `tools/mock-api` (`settings.apiBaseUrl`), `tools/mock-vendor`                                                                                       |
| Build config                  | `@org/webpack-config` (apps keep a one-line `webpack.config.js`)                                                                                    |
| Config / env                  | [docs/configuration.md](docs/configuration.md): `.env` per zone + per-shell override, `.env.example`, `pnpm check` (check-env)                      |
| Tests                         | [docs/testing.md](docs/testing.md)                                                                                                                  |
| Versions / gotchas            | [docs/toolchain.md](docs/toolchain.md)                                                                                                              |
| Deploy                        | `deploy/`, [docs/devops-handoff.md](docs/devops-handoff.md)                                                                                         |
| Spec Kit                      | `.specify/`, `.cursor/skills/speckit-*`, feature specs in `specs/`                                                                                  |
