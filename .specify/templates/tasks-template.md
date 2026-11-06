---
description: 'Task list template for feature implementation'
---

# Tasks: [FEATURE NAME]

**Input**: Design documents from `/specs/[###-feature-name]/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: The examples below include test tasks. Tests are OPTIONAL - only include them if explicitly requested in the feature specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Apps: `apps/<zone>/<portal>/<app>/src/` (canonical layout: `app/`, `features/`,
  `pages/`, `layouts/`, `components/`, `core/`, `services/`,
  `main.tsx`); shared code (docs/where-code-goes.md): one zone
  `apps/<zone>/libs/<capability>/src/`, both zones (public) `packages/common/<capability>/src/`,
  plumbing `packages/platform/<name>/src/`; new library: `pnpm gen:package <common|zone> <capability>`
- New apps: a setup task runs the generator (`pnpm gen:shell <zone>`,
  `pnpm gen:remote <zone> <name> [--private] [--external]`) and `pnpm install`;
  never copy an app folder
- Shells: routes come from `remotes.json`; dev URLs from the generated `mfe-manifest.dev.json`
  (`pnpm dev-manifest`, extra dev props in the shell's package.json `mfe.devManifest`);
  production URLs are per-environment manifest changes for DevOps (list them)
- Remotes: tasks cover standalone and embedded behaviour; no imports of other
  remotes or shells
- Domain work belongs under `features/<name>/` with a public `index.ts`
- Tests: unit tests beside the source (`*.test.tsx`), feature e2e flows in
  `apps/<zone>/<zone>/shell/e2e/<feature>.spec.ts`; a11y via the zone suite
- Dependencies: tasks name the tier and the command (`pnpm --filter <app> add …`,
  catalog edits in `pnpm-workspace.yaml`)
- Finish with `pnpm check && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
  and `pnpm e2e:<zone>` for each affected zone

<!--
  ============================================================================
  IMPORTANT: The tasks below are SAMPLE TASKS for illustration purposes only.

  The /speckit-tasks command MUST replace these with actual tasks based on:
  - User stories from spec.md (with their priorities P1, P2, P3...)
  - Feature requirements from plan.md
  - Entities from data-model.md
  - Endpoints from contracts/

  Tasks MUST be organized by user story so each story can be:
  - Implemented independently
  - Tested independently
  - Delivered as an MVP increment

  DO NOT keep these sample tasks in the generated tasks.md file.
  ============================================================================
-->

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create project structure per implementation plan
- [ ] T002 Initialize [language] project with [framework] dependencies
- [ ] T003 [P] Configure linting and formatting tools

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

Examples of foundational tasks (adjust based on your project):

- [ ] T004 Setup database schema and migrations framework
- [ ] T005 [P] Implement authentication/authorization framework
- [ ] T006 [P] Setup API routing and middleware structure
- [ ] T007 Create base models/entities that all stories depend on
- [ ] T008 Configure error handling and logging infrastructure
- [ ] T009 Setup environment configuration management

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - [Title] (Priority: P1) 🎯 MVP

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 1 (OPTIONAL - only if tests requested) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T010 [P] [US1] Contract test for [endpoint] in packages/[pkg]/src/[name].test.ts
- [ ] T011 [P] [US1] Integration test for [user journey] in apps/[zone]/[shell]/shell/e2e/[name].spec.ts

### Implementation for User Story 1

- [ ] T012 [P] [US1] Create [Entity1] model in apps/[zone]/[app]/src/features/[feature]/types/[entity1].ts
- [ ] T013 [P] [US1] Create [Entity2] model in apps/[zone]/[app]/src/features/[feature]/types/[entity2].ts
- [ ] T014 [US1] Implement [Service] in apps/[zone]/[app]/src/features/[feature]/api/[service].ts (depends on T012, T013)
- [ ] T015 [US1] Implement [endpoint/feature] in apps/[zone]/[app]/src/[location]/[file].tsx
- [ ] T016 [US1] Add validation and error handling
- [ ] T017 [US1] Add logging for user story 1 operations

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - [Title] (Priority: P2)

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 2 (OPTIONAL - only if tests requested) ⚠️

- [ ] T018 [P] [US2] Contract test for [endpoint] in packages/[pkg]/src/[name].test.ts
- [ ] T019 [P] [US2] Integration test for [user journey] in apps/[zone]/[shell]/shell/e2e/[name].spec.ts

### Implementation for User Story 2

- [ ] T020 [P] [US2] Create [Entity] model in apps/[zone]/[app]/src/features/[feature]/types/[entity].ts
- [ ] T021 [US2] Implement [Service] in apps/[zone]/[app]/src/features/[feature]/api/[service].ts
- [ ] T022 [US2] Implement [endpoint/feature] in apps/[zone]/[app]/src/[location]/[file].tsx
- [ ] T023 [US2] Integrate with User Story 1 components (if needed)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - [Title] (Priority: P3)

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 3 (OPTIONAL - only if tests requested) ⚠️

- [ ] T024 [P] [US3] Contract test for [endpoint] in packages/[pkg]/src/[name].test.ts
- [ ] T025 [P] [US3] Integration test for [user journey] in apps/[zone]/[shell]/shell/e2e/[name].spec.ts

### Implementation for User Story 3

- [ ] T026 [P] [US3] Create [Entity] model in apps/[zone]/[app]/src/features/[feature]/types/[entity].ts
- [ ] T027 [US3] Implement [Service] in apps/[zone]/[app]/src/features/[feature]/api/[service].ts
- [ ] T028 [US3] Implement [endpoint/feature] in apps/[zone]/[app]/src/[location]/[file].tsx

**Checkpoint**: All user stories should now be independently functional

---

[Add more user story phases as needed, following the same pattern]

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] TXXX [P] Documentation updates in docs/
- [ ] TXXX Code cleanup and refactoring
- [ ] TXXX Performance optimization across all stories
- [ ] TXXX Verify primary flows at phone-width (no horizontal scroll)
- [ ] TXXX [P] PWA baseline: manifest, icons, service worker / equivalent
- [ ] TXXX [P] Additional unit/component tests (if requested), co-located beside the source modules they verify
- [ ] TXXX Security hardening
- [ ] TXXX Run quickstart.md validation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - May integrate with US1 but should be independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - May integrate with US1/US2 but should be independently testable

### Within Each User Story

- Tests (if included) MUST be written and FAIL before implementation
- Models before services
- Services before endpoints
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- All tests for a user story marked [P] can run in parallel
- Models within a story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together (if tests requested):
Task: "Contract test for [endpoint] in packages/[pkg]/src/[name].test.ts"
Task: "Integration test for [user journey] in apps/[zone]/[shell]/shell/e2e/[name].spec.ts"

# Launch all models for User Story 1 together:
Task: "Create [Entity1] model in apps/[zone]/[app]/src/features/[feature]/types/[entity1].ts"
Task: "Create [Entity2] model in apps/[zone]/[app]/src/features/[feature]/types/[entity2].ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1
   - Developer B: User Story 2
   - Developer C: User Story 3
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
