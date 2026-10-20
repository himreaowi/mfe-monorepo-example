# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]

**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for this feature. Defaults below match the MFE Monorepo constitution (v3);
  keep, narrow, or mark NEEDS CLARIFICATION as appropriate.
-->

**Language/Version**: TypeScript (catalog version) + React 19, Node 24 for tooling

**Primary Dependencies**: React, React Router, Rspack + Module Federation 2 via
`@org/rspack-config`; workspace packages `@org/ui`, `@org/design-tokens`,
`@org/mf-runtime`, `@org/auth`, `@org/http-client`, `@org/pwa` (as needed). New
third-party dependencies: state the tier (1 / 2 / 3, `docs/adding-dependencies.md`)

**Storage**: N/A for UI (data via the BFF / APIs; browser storage only if in scope)

**Testing**: Jest + React Testing Library co-located in `src/`; `node --test` for
tooling/contracts; the zone e2e suite in `apps/<zone>/shell-<zone>/e2e/`
(Playwright + axe WCAG 2.2 AA, light + dark, desktop + 375 px)

**Target Platform**: Modern evergreen browsers incl. phone-width; PWA shell

**Project Type**: pnpm + Nx monorepo, zones `intranet` / `internet`, apps under
`apps/<zone>/<name>` (shell or remote, `access: public|private`, optional
`kind: external` adapter)

**Performance Goals**: interactive route usable under ~2 s on broadband; no
duplicate tier-1 libraries; measure remote load cost for new federated surfaces

**Constraints**: tier-1 singletons via MF `strictVersion`; one build for all
environments (`mfe-manifest.json` per environment); no secrets or tokens in the
browser (BFF); shells never import remotes, remotes never import remotes, zones
share only `packages/*`; WCAG 2.2 AA; 375 px without horizontal scroll

**Scale/Scope**: name the zone(s) and apps, e.g.
`Zone: internet. Apps: my-profile (private remote), shell-internet (nav entry).
Packages: @org/ui (new Card). Out: intranet zone, other remotes.`

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Derived from `.specify/memory/constitution.md` (MFE Monorepo Constitution v3).

- **I. Apps & zones**: apps affected are listed with zone and type; new apps are
  created with the generators; no shell→remote, remote→remote or cross-zone
  imports; every touched remote still runs standalone and embedded.
- **II. Singletons & tiers**: each new dependency has a tier; tier-1 changes
  update the catalog, `TIER1` and `TIER1_SINGLETONS` together; exceptions are
  justified in `version-exceptions.json`.
- **III. Contracts**: changes to the manifest schema, host props, mount contract or
  auth contract are listed with their version impact (MAJOR/MINOR) and migration;
  failures degrade to a fallback.
- **IV. Security & privacy**: no tokens or secrets in the browser; minimal user
  data; CSP/vendor origins listed for DevOps; dev-only code stays out of
  production builds.
- **V. UI**: composition over prop flags; tokens over hardcoded values; the shell
  owns global styles/theme/service worker.
- **VI. Verification**: unit tests for new logic; contract tests for changed
  contracts; the zone e2e suite covers new routes/flows.
- **VII. A11y / responsive / PWA**: WCAG 2.2 AA in light and dark; 375 px; PWA
  impact stated (verified, deferred with follow-up, or N/A).
- **Complexity Tracking**: any MUST exception is listed below with justification,
  otherwise the plan MUST NOT proceed.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

<!--
  ACTION REQUIRED: keep only the apps/packages this feature touches and replace
  placeholders with concrete paths. New apps come from the generators.
-->

```text
apps/
└── [zone]/
    ├── shell-[zone]/              # host: routes from remotes.json, e2e/ suite
    │   ├── remotes.json           # registry (gen:remote)
    │   ├── mfe-manifest.dev.json  # generated dev manifest (pnpm dev-manifest; prod: per environment, DevOps)
    │   ├── e2e/                   # zone e2e + a11y suite
    │   └── src/
    └── [remote]/                  # remote (or --external adapter)
        └── src/
            ├── app/               # RemoteApp (exposed ./App), apps, routes
            ├── features/[feature]/
            │   ├── api/
            │   ├── hooks/
            │   ├── types/
            │   ├── utils/
            │   ├── components/[Component]/  # [Component].tsx, .module.scss, .test.tsx, index.ts
            │   ├── __fixtures__/            # shared test data
            │   └── index.ts
            ├── pages/
            ├── components/[Component]/
            ├── core/constants/    # routePaths, apiRoutes
            └── services/          # optional (API client: useApiClient() from @org/mf-runtime)
packages/
└── [package]/                     # shared code (type:package), e.g. ui, mf-runtime
```

**Zones / apps**: [e.g. internet: shell-internet, my-profile]

**Structure Decision**: [Concrete paths used by this feature. Unit tests beside
the source; feature flows in the zone's `e2e/`. For a remote: standalone and
embedded behaviour, host props used. For a shell: registry/route changes and
fallback behaviour. For shared packages: who depends on them (all affected apps
are rebuilt and retested). New dependencies with their tier.]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |
