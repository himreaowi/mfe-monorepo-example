# AGENTS.md

Instructions for AI coding agents (and humans) working in this monorepo. Details live in
`docs/`; on conflict with generic React or agent advice, the repo docs win.

## Before changing code

1. [docs/architecture.md](docs/architecture.md): zones, shells vs remotes, runtime manifest,
   decisions D1–D8.
2. [docs/coding-conventions.md](docs/coding-conventions.md): where code goes, data fetching.
3. [docs/ui-context.md](docs/ui-context.md) before UI, token, theme or component work.
4. [docs/project-overview.md](docs/project-overview.md) for product intent;
   [.specify/memory/constitution.md](.specify/memory/constitution.md) for principles.
5. Match existing patterns: the generated apps (`tools/generators/templates/`) and
   `packages/*`.

## Must follow

- Create apps only with `pnpm gen:shell <zone>` / `pnpm gen:remote <zone> <name> [--private]
[--external [--vendor-format esm|web-component|script]] [--title "<text>"]`, then
  `pnpm install`. Never copy an app folder.
- A shell never imports a remote; a remote never imports another remote or a shell; zones
  (intranet, internet) share only `packages/*`. Shared code → a package in `packages/`.
- Dependencies: add to the package that uses it (`pnpm --filter <pkg> add <dep>`). Catalog
  packages use `catalog:`; a library used by 2+ packages goes into the catalog; tier-1
  (`react`, `react-dom`, `react-router`, `@org/ui`, `@org/auth`) never differs. See
  [docs/adding-dependencies.md](docs/adding-dependencies.md). Never hand-edit `pnpm-lock.yaml`.
- No environment URLs or config in code or build: runtime config comes from
  `mfe-manifest.json` (`settings`, remote `props`). No tokens or secrets in the browser (BFF
  pattern, [docs/auth-contract.md](docs/auth-contract.md)).
- Remotes: the exposed `src/app/RemoteApp.tsx` must not import global styles or register a
  service worker; links use `useRemotePath()`; keep standalone mode working.
- No hardcoded API or app paths in components (`apiRoutes`, `routePaths`); no API calls in
  component `useEffect` (use `features/*/api` + `features/*/hooks`).
- Tokens (`var(--…)`) over hardcoded colours/spacing; WCAG 2.2 AA in light and dark; works at
  375 px (`MainLayout` already collapses the header; no per-app menus).
- Forms validate on submit with an error summary + field errors; submit is disabled only while
  sending ([docs/coding-conventions.md](docs/coding-conventions.md)).
- Dev ports: apps 3100–3189 / 3200–3289; 3190–3199 / 3290–3299 are the zones' dev tools (mock
  API, mock vendor). Mock endpoints go into `tools/mock-api`.
- Tests with the change: unit tests next to the code; flows in the zone's
  `apps/<zone>/shell-<zone>/e2e/`. Import `test`/`expect` from `@org/playwright-config/test`.
- Done means green: `pnpm check && pnpm lint && pnpm typecheck && pnpm test` (+ `pnpm build`
  and `pnpm e2e:<zone>` when apps changed) and `pnpm format:check`.
- Do not disable guardrails, lint rules or axe rules to get green; fix the cause or ask.
- Do not commit or push unless asked. Never commit secrets.

## Quick pointers

| Concern                       | Location                                                                         |
| ----------------------------- | -------------------------------------------------------------------------------- |
| Generators + templates        | `tools/generators/`                                                              |
| Guardrails (`pnpm check`)     | `tools/scripts/src/check-*.js`, [docs/guardrails.md](docs/guardrails.md)         |
| Shell registry / dev manifest | `apps/<zone>/shell-<zone>/remotes.json`, `mfe-manifest.dev.json`                 |
| Manifest schema               | `packages/mf-runtime/src/manifest/mfe-manifest.schema.json`                      |
| Host props (remote side)      | `@org/mf-runtime/remote` (`useHostProps`, `useRemotePath`, `createRemoteApp`)    |
| Auth                          | `@org/auth`, [docs/auth-contract.md](docs/auth-contract.md)                      |
| Vendor modules                | `@org/mf-runtime/external`, [docs/external-modules.md](docs/external-modules.md) |
| Dev mocks (per zone)          | `tools/mock-api` (`settings.apiBaseUrl`), `tools/mock-vendor`                    |
| Build config                  | `@org/rspack-config` (apps keep a one-line `rspack.config.js`)                   |
| Tests                         | [docs/testing.md](docs/testing.md)                                               |
| Versions / gotchas            | [docs/toolchain.md](docs/toolchain.md)                                           |
| Deploy                        | `deploy/`, [docs/devops-handoff.md](docs/devops-handoff.md)                      |
| Spec Kit                      | `.specify/`, `.cursor/skills/speckit-*`, feature specs in `specs/`               |
