<!--
Sync Impact Report
- Version change: 2.2.0 (starter-mfe, multi-repo) → 3.0.0 (monorepo template)
- Redefined principles (MAJOR):
  - I. Dual-Mode Portability → I. Independently Deployable Apps in One Monorepo (zones, tiers of
    apps, generators; host/remote/standalone/hybrid roles per clone removed)
  - II. Shared Runtime Singletons → II. Runtime Singletons and Dependency Tiers (D4)
  - III. Explicit Host/Remote Contracts → III. Explicit Runtime Contracts (manifest, host props,
    mount contract, auth contract)
- Added principles: IV. Secure and Private by Default (D3, D6), VII. Accessible, Responsive,
  PWA-ready (merges starter VI + WCAG 2.2 AA)
- Removed: hybrid role and nested composition (D5), multi-repository topology constraint
  (replaced by the monorepo, D1/D7)
- Templates updated: .specify/templates/plan-template.md ✅, spec-template.md ✅,
  tasks-template.md ✅; checklist/constitution templates unchanged; .cursor/skills/speckit-*
  reviewed (generic, no edits)
- Runtime guidance: AGENTS.md ✅, README.md ✅, docs/coding-conventions.md ✅
- v3.1.0 (MINOR): webpack replaces Rspack; several shells per zone with base paths and a zone port
  plan; same-origin /api and /auth proxy with variables; @org/ui library + Storybook; page-level
  data fetching and the Context + reducer state pattern. Templates re-checked.
- Follow-up TODOs: none
-->

# MFE Monorepo Constitution

Decisions D1–D8 referenced below are recorded in `docs/architecture.md`.

## Core Principles

### I. Independently Deployable Apps in One Monorepo

All frontend apps live in one pnpm + Nx workspace (D1). Each app is built and deployed on its
own.

- Apps live at `apps/<zone>/<name>/` and are created with the generators (`pnpm gen:shell`,
  `pnpm gen:remote [--shell <s>] [--private] [--external]`). Every app declares Nx tags (`zone:`, `type:`,
  `access:`, `kind:`) and `mfe.port` / `mfe.federationName` (shells also `mfe.basePath`) in its `package.json`. Dev ports
  per zone: proxy x00, shells x01–x09, remotes x10–x89, tools x90–x99 (intranet 31xx,
  internet 32xx).
- **Zones** (`intranet`, `internet`) each have one or more shells (`shell-<name>`, e.g.
  `pnpm gen:shell internet citizen --base-path /citizen`); several shells of a zone share one
  origin, each under its own `mfe.basePath`, and a remote may be listed by several shells of
  the same zone (`pnpm gen:remote <zone> <name> --shell <s>`). Zones share nothing but
  `packages/*` (D5): no remote is used by shells of two zones.
- A **shell** loads its remotes at runtime from `/mfe-manifest.json`; it MUST NOT import remote
  code. A **remote** MUST NOT import another remote or a shell. Shared code goes to
  `packages/`.
- Every remote MUST run standalone (`pnpm dev` in its folder, mock host props) and embedded in
  its shell, from the same feature code. Breaking either mode is a violation.
- There is no hybrid layer (D5). Public vs signed-in areas of the internet zone are route
  guards (`access:private`) inside the internet zone's shell, not a separate layer.
- Every app and package keeps its own `node_modules` (pnpm isolated layout, D7) and declares
  every dependency it uses.

Rationale: one workspace keeps versions, tooling and guardrails consistent; independent builds
and runtime loading keep team ownership and deployments separate.

### II. Runtime Singletons and Dependency Tiers

Libraries that must be unique in the page are shared once; everything else has one version per
repo unless an exception is justified (D2, D4).

- **Tier 1** (core singletons: `react`, `react-dom`, `react-router`, `@org/ui`, `@org/auth`):
  one version in the default catalog / workspace, shared by Module Federation as
  `singleton` + `strictVersion`. A different major means the app integrates as an isolated
  mount-contract module, not a plain remote.
- **Tier 2** (used by 2+ workspace packages): one version in the default catalog, bundled per
  app.
- **Tier 3** (used by one app): a normal range in that app's `package.json`.
- Libraries holding cross-app state or React context (router, query cache, i18n, global store)
  MUST be tier 1.
- Exceptions go into `version-exceptions.json` (package, version, app, reason, owner, expires)
  in the same pull request; expired exceptions fail CI.
- `pnpm check` enforces these rules; nobody bypasses it.

Rationale: duplicate React or router copies break hooks and context; version drift between
apps multiplies upgrade cost.

### III. Explicit Runtime Contracts

Every boundary between independently deployed pieces is typed, versioned and documented
before it is used.

- **Manifest**: `mfe-manifest.json` (schema in `@org/mf-runtime`) is per environment and never
  built in. One build serves every environment.
- **Host props** (`HostProps` in `@org/mf-runtime/remote`): what a shell passes to a remote
  (`basePath`, `user`, `settings`, manifest `props`).
- **Mount contract** (`MOUNT_CONTRACT_VERSION`, `docs/external-modules.md`): for vendors, other
  frameworks and other React majors.
- **Auth contract** (`docs/auth-contract.md`): the BFF endpoints.
- Breaking changes are MAJOR and need a migration plan for every consumer; additive changes
  are MINOR.
- Loading MUST degrade safely: a missing, failing or blocked remote or vendor module shows a
  fallback with retry; the shell and its other routes keep working.
- Cross-app communication uses these contracts only: no undocumented globals.

Rationale: implicit coupling between separately deployed apps is the main source of
production MFE incidents.

### IV. Secure and Private by Default

- Auth is provider-agnostic and backend-owned (BFF, D6): the browser never receives, stores or
  sends tokens. Remotes get a PDPA-minimal user (`{ id, name?, roles? }`).
- Private routes are a UX boundary, not a security boundary: every API checks the session.
- No secrets in client bundles or manifests. Environment-specific URLs are configuration.
- Vendors have no repo access (D3). Their modules run under a CSP allow-list, SRI-pinned,
  versioned URLs; untrusted code goes in an iframe.
- Environment URLs are never built in: the same-origin `<base>/api` and `<base>/auth` proxy
  (upstreams `API_UPSTREAM` / `AUTH_UPSTREAM`) and the manifest generated at container start
  from variables (`docs/configuration.md`) keep one image for every environment; the browser
  calls relative paths, never an absolute `apiBaseUrl`.
- Dev-only code (mock auth, mock vendor) MUST be absent from production builds.

Rationale: microfrontends multiply the code running in one origin; least privilege keeps a
single faulty or compromised module from reaching user sessions.

### V. Composition-First UI and One Design System

- Shared components (the `@org/ui` library, documented in Storybook), tokens and theme live in `packages/ui` and `packages/design-tokens`;
  apps consume `var(--…)` tokens instead of hardcoded colours and spacing.
- Prefer composition (children, slots, small hooks) over boolean-prop sprawl. No Atomic Design
  folder taxonomy; one folder per component (`<Component>.tsx`, own `.module.scss`, test;
  no `index.ts` barrel, imports name the file; CSS Modules class names are readable,
  `Component_class__hash`): shared components at `components/<Component>/`, feature UI under
  `features/<name>/components/<Component>/`.
- The shell owns the document (global styles, theme attribute, service worker). Remotes never
  import global styles or register a service worker from their exposed module.

Rationale: one design system keeps independently built apps looking like one product.

### VI. Verifiable Isolation

- Domain and UI logic are unit-testable without a running shell (Jest + RTL).
- Contracts and generated artefacts have contract tests (`node --test`).
- Each zone has an e2e suite (generated in its shell) covering every remote embedded and
  standalone, private-route guards and external adapters; it runs in CI.
- A change is not done until `pnpm check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`,
  `pnpm build` and the affected zones' `pnpm e2e:<zone>` pass.

Rationale: isolation that is not verified regresses with independent deployments.

### VII. Accessible, Responsive, PWA-ready

- UI meets **WCAG 2.2 AA** in the light and the dark theme; axe runs on every page in CI and
  violations fail the build. Manual checks cover what axe cannot (keyboard, screen reader,
  zoom).
- Primary flows work at 375 px without horizontal scrolling; touch targets stay operable.
  Responsive behaviour adapts presentation, not business logic.
- Shells ship the PWA baseline (manifest, icons, service worker) and own install/offline UX;
  remotes stay safe when embedded.

Rationale: public-sector users rely on assistive technology and phones; accessibility and
resilience are product quality, not polish.

## Technology Constraints

- Node 24 LTS, pnpm via Corepack (`packageManager`), pnpm catalog (`catalogMode: manual`),
  Nx package-based mode, webpack 5 (`@org/webpack-config`) + Module Federation 2 (`@module-federation/enhanced`),
  Storybook 10 for `@org/ui` (dev only),
  React 19, TypeScript (version in the catalog; see `docs/toolchain.md`).
- Frontend only (D8): backends, pipelines and infrastructure belong to other teams; this repo
  provides contracts, `deploy/` reference templates and `docs/devops-handoff.md`.
- Canonical app layout (generated):

```text
apps/<zone>/<name>/src/
├── main.tsx          # entry (MF async startup): shell: global styles, PWA, manifest, render;
│                     #   remote: standalone only
├── app/              # providers, routes, registry (shell) / apps (exposed ./App), routes (remote)
├── features/<name>/  # domain modules; index.ts = the feature's public API (the only barrel)
│                     #   (api/, hooks/, state/, types/, utils/,
│                     #   components/<Component>/ one folder per component, __fixtures__/)
├── pages/            # route-level screens: fetch data (page-level), compose features
├── layouts/          # chrome
├── state/            # optional app-level Context + reducer (createRemoteApp providers);
│                     #   shareable filters live in the URL, not in state
├── components/       # shared UI of this app, one folder per component
├── core/             # constants (routePaths, apiRoutes), types, utils (no parallel lib/)
└── services/         # optional app-wide infra; the API client is useApiClient() (@org/mf-runtime)
```

## Quality Gates & Workflow

- CI order: `pnpm install --frozen-lockfile` → `pnpm check` → `pnpm lint` → `pnpm typecheck` →
  `pnpm test` → `pnpm build` → `pnpm e2e:<zone>` (affected apps/zones only, see
  `docs/devops-handoff.md`).
- Spec Kit (`specify` → `plan` → `tasks` → `implement`, plus `clarify` / `checklist` /
  `converge`) is the default process for non-trivial work.
- Plans, PRs and agent changes MUST state: the zone(s) and apps affected, new dependencies and
  their tier, contract changes (manifest, host props, mount, auth) and their version impact,
  standalone + embedded impact for remotes, and a11y / responsive / PWA impact.
- Complexity beyond these principles is recorded in the plan's Complexity Tracking table with
  the simpler alternative that was rejected.

## Governance

This constitution supersedes informal conventions. Amendments require:

1. An edit to this file with a semantic version bump (MAJOR: remove/redefine a principle;
   MINOR: add or materially expand one; PATCH: wording).
2. A review of the Spec Kit templates and agent docs (`AGENTS.md`, `docs/coding-conventions.md`)
   when gates or mandatory sections change.
3. A Sync Impact Report (HTML comment at the top of this file).

Compliance: `/speckit-plan`'s Constitution Check is the primary gate; reviewers and agents
reject changes that violate a MUST without an approved Complexity Tracking entry. On conflict
with other docs, this file wins.

**Version**: 3.1.0 | **Ratified**: 2026-07-30 | **Last Amended**: 2026-10-21
