# Coding conventions

Source of truth for contributor and agent coding standards in this monorepo. Plain Markdown,
IDE- and agent-agnostic.

Principles live in [`.specify/memory/constitution.md`](../.specify/memory/constitution.md);
architecture in [architecture.md](architecture.md).

**Precedence:** this file, `AGENTS.md`, [ui-context.md](ui-context.md) and the constitution win
over generic React or agent-skill advice. Prefer patterns already in this repo (the generated
apps and `packages/*`) over alternatives from external guides.

**Goals:** readable, maintainable, testable code with safe handling at trust boundaries (forms,
APIs, manifest, vendor modules).

## Where code goes

| What                   | Where                                                                                                                                                                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A new app              | `pnpm gen:shell` / `pnpm gen:remote` ([adding-an-app.md](adding-an-app.md)); never copy an app folder                                                                                                                                        |
| A UI component         | `@org/ui` first ([Use @org/ui first](#use-orgui-first)); an app-level component only for what is specific to that app                                                                                                                        |
| Code used by 2+ apps   | one zone: `apps/<zone>/libs/<capability>`; both zones and fine to be public: `packages/common/<capability>` (`pnpm gen:package`, `workspace:*` dependency); never confidential rules in common. See [where-code-goes.md](where-code-goes.md) |
| Code used by one app   | that app's `src/`                                                                                                                                                                                                                            |
| Build/test/lint config | the shared config packages (`@org/webpack-config`, `@org/jest-config`, `@org/playwright-config`, `@org/eslint-config`, `@org/tsconfig`, `@org/prettier-config`); apps keep one-line config files                                             |
| Repo tooling           | `tools/`                                                                                                                                                                                                                                     |

Hard rules (enforced by `pnpm check` and ESLint, see [guardrails.md](guardrails.md)):

- A shell never imports a remote; a remote never imports another remote or a shell; the zones
  share only `packages/common/*` and `packages/platform/*`.
- Libraries and packages never import apps; `packages/common` never imports zone code;
  `packages/platform` only platform (import table: [where-code-goes.md](where-code-goes.md)).
- Every package declares what it imports (isolated `node_modules`, D7). Dependency versions
  follow the tiers in [adding-dependencies.md](adding-dependencies.md).

## Use @org/ui first

Before writing a component, use the in-house library `@org/ui`
([packages/platform/ui/README.md](../packages/platform/ui/README.md), browse it with `pnpm storybook`): Button,
Link, TextField, TextArea, Select, DateField, Checkbox, RadioGroup, Dialog, Alert, Card, Badge,
Spinner, Table, Tabs, VisuallyHidden. They are built on native elements, use the tokens, work in
both themes and pass axe (WCAG 2.2 AA) in every state.

- Forms: `TextField` / `Select` / `DateField` / `TextArea` / `Checkbox` / `RadioGroup` with
  `label`, `hint`, `error` (they wire `aria-describedby` and `aria-invalid`); `Alert` for the
  error summary and form-level errors; `Button type="submit" loading={sending}`.
- Loading: `Spinner` (its `role="status"` label starts with "Loading", which the e2e helper
  `settle(page)` waits for). Messages: `Alert`. Lists of records: `Table` (or `Card` per item
  for a card grid). Status labels: `Badge`. Confirmations: `Dialog`.
- An app component may **compose** library components (e.g. `ModeBadge` wraps `Badge` with the
  app's wording); it must not copy their markup or styles.
- Do not add an external UI or headless library (React Aria, Radix, MUI, …) to an app. A
  missing component or variant is added to `@org/ui` (README "Adding a component").
- `pnpm check` flags a component folder name that exists in two or more apps
  (`shared-component`): move it to `@org/ui`, or, when each app really needs its own, list it
  with a reason in the root `package.json` `mfe.componentDuplicatesAllowed`.

## Layers inside an app

| Layer                  | Role                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| `src/main.tsx`         | Entry. Shell: global styles, PWA, manifest, auth client, render. Remote: standalone entry only    |
| `src/app/`             | Wiring: providers, routes, registry (shell); `apps` (exposed `./App`), routes (remote)            |
| `src/features/<name>/` | Domain UI (`components/<Name>/`) + `api/` / `hooks/` / `types/` / `utils/`, public `index.ts`     |
| `src/pages/`           | Route containers: call the features' data hooks, pass data down, compose feature components       |
| `src/components/`      | UI primitives of this app, one folder per component (shared ones go to `@org/ui`)                 |
| `src/layouts/`         | Chrome, owned by the app: `ShellLayout` (shell), `StandaloneLayout` (remote), one folder each     |
| `src/core/`            | Constants (`routePaths`, `apiRoutes`, `app`), types, small utils (no parallel `lib/`)             |
| `src/styles/`          | Shell only: `shell.scss`, shell-wide global styles (empty by default)                             |
| `src/services/`        | Optional app-wide infra. Not generated: the API client is `useApiClient()` from `@org/mf-runtime` |

**Rule of thumb:** pages fetch and compose, features own domain logic and data hooks, components
stay presentational,
core holds constants, `api/` modules own the requests (through `useApiClient()`).

New capability: `features/<name>/` (types → api → hooks → UI) → thin `pages/` entry → route in
`app/routes.tsx` using `routePaths`.

## One folder per component

Every component of a feature gets its own folder under `components/`, in every app (shells,
remotes, external adapters). The app's own `src/components/` follows the same rule and naming.

```
src/features/<feature>/
  api/  hooks/  types/  utils/          request functions, state hooks, types, pure helpers
  components/
    <ComponentName>/
      <ComponentName>.tsx
      <ComponentName>.module.scss       only if it has styles; never shared between components
      <ComponentName>.test.tsx          every component has a test (no index.ts: import the file)
      types.ts                          optional: props types, if non-trivial
      <SubComponent>.tsx                optional: private parts used only by this component
  __fixtures__/                         test data shared by several tests (or utils/testData.ts)
  index.ts                              the feature's public API (the only barrel)
```

Why:

- **Co-located styles and tests**: a component's markup, styles and test move, change and get
  deleted together. No `Feature.module.scss` that every component imports, where nobody knows
  which rule is still used.
- **Missing tests are visible**: a folder without `<Name>.test.tsx` stands out in review (and
  `pnpm check` reports it, rule `component-test`).
- **Scales with sub-components**: when a component grows, its private parts (`<SubComponent>.tsx`)
  go into its folder instead of crowding `components/`; other features see only the feature's
  `index.ts`.

Rules:

- **No barrel files.** Import a component from its file (`'../StaffCard/StaffCard'`,
  `'@/components/ModeBadge/ModeBadge'`, `'../api/itemsApi'`); component, layout, page and
  provider folders have no `index.ts`. The one exception is the feature's public API,
  `features/<feature>/index.ts`: other features, pages and `app/` import a feature through it
  only. Why: one name per thing (the editor's "go to definition" and search land on the
  component, not on a re-export), no file that only forwards, no accidental import cycles
  through a barrel. `pnpm check` reports other `index.ts` files (rule `barrel-file`).
- A `.module.scss` is imported only from its own folder (the component and its private
  sub-parts). Shared values come from tokens (`var(--…)` from `@org/design-tokens`). When two
  components really share a style, decide case by case: duplicate a few declarations (simplest,
  usually right), extract a small shared component that owns the style (a reused card, a
  status message), or put a mixin in a Sass partial (`_<name>.scss` next to the feature's
  components, `@use`d by each module). Never let a component's styles reach into a child
  component's markup (`.panel a { … }` styles the children too and depends on CSS order).
- `layouts/` follows the same rule as `components/`: `ShellLayout/{ShellLayout.tsx,
ShellLayout.module.scss, ShellLayout.test.tsx}` (small private parts of the layout
  may sit in the same folder). A layout is real code (the shell's header, nav, disclosure), so
  it has its own test. `pages/` use one folder per page (`HomePage/HomePage.tsx`, imported as
  `@/pages/HomePage/HomePage`)
  without a test requirement of their own (routes and app tests cover them).
- **Where test data goes**: data used by one test stays in that test file. Data shared by several
  tests of a feature goes to `features/<feature>/__fixtures__/<name>.ts` (or
  `utils/testData.ts`), never inside `components/` (a file there is not a component). Jest only
  runs `*.test.ts(x)`, so fixtures are never collected as tests; production code never imports
  them.
- Non-component modules of a feature go to `api/` (requests, response normalisation), `hooks/`,
  `types/` or `utils/` (pure helpers such as validation or formatting), with their tests next to
  them.

`pnpm check` enforces the layout (rules `component-folder`, `component-test`, `component-style`,
[guardrails.md](guardrails.md)). The generated apps follow it: the remote's `features/demo`, the
shell's `features/welcome` and `features/startup` and its `layouts/ShellLayout`, the remote's
`layouts/StandaloneLayout`, the adapter's `features/external`.

## Remotes

A remote's wiring is five files; everything else is features, pages and layouts:

| File                 | Role                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------- |
| `package.json`       | name, Nx tags, `mfe.port` / `mfe.federationName` (read by the config and the tools)      |
| `webpack.config.js`  | `createRemoteConfig` (exposes `./App` → `src/app/apps.tsx`, MF async startup)            |
| `src/main.tsx`       | standalone entry: global styles + `<StandaloneApp />`                                    |
| `src/app/apps.tsx`   | the exposed module: `createRemoteApp(…)`, standalone mock host props, optional providers |
| `src/app/routes.tsx` | relative routes                                                                          |

The API client is `useApiClient()` from `@org/mf-runtime/remote` (no per-app file) and the
shell's dev manifest entry is generated (`pnpm dev-manifest`).

- `src/app/apps.tsx` is the exposed module (`./App`): its default export is the embedded app,
  its named `StandaloneApp` is rendered by `src/main.tsx`, and it holds the standalone mock host
  props. Nothing it reaches may import global styles (`@org/design-tokens/global.scss`) or
  register a service worker; `apps.test.tsx` walks its import graph to enforce this
  (`scanExposedModule` from `@org/jest-config/exposed-module`).
- Routes are relative (they match below the shell's `/<remote>/*` and from `/` standalone).
  Links between pages use `useRemotePath()` from `@org/mf-runtime/remote`, never hardcoded
  absolute paths.
- Read host data from `useHostProps()` (`user`, `settings`, `basePath`, manifest `props`).
  `useAuth()` from `@org/auth` gives the shell's session (`csrfToken`, `refresh()` after a 401).
- Both modes must keep working: embedded in the shell and standalone with
  `standaloneProps` (mock host props in `src/app/apps.tsx`).

## Shells

- Remotes appear only through `remotes.json` (registry) and the manifest; no remote code, no
  remote package dependency.
- Private remotes are wrapped in `<RequireAuth>` by `RemotePage`; do not render a private
  remote anywhere else.
- Runtime configuration (API base URL, feature settings) comes from the manifest's `settings`,
  never from build-time constants or `.env` files.

## Data fetching

- Do **not** hardcode API paths in components: define them in `core/constants/apiRoutes.ts`
  (`defineApiRoutes`) and call them through `useApiClient()`: from `@org/mf-runtime/remote` in a
  remote (base URL from host props `settings.apiBaseUrl`), from `@org/mf-runtime` in a shell
  (base URL from the loaded manifest's `settings.apiBaseUrl`). Both use `createApiClient` from
  `@org/http-client` (`credentials: 'include'`) and return `undefined` when no API is
  configured. No per-app `services/http.ts`.
- Do **not** hardcode app paths: use `routePaths` / `useRemotePath()`.
- Do **not** call APIs in a component's `useEffect`. Use `features/<feature>/api/` (pure request
  functions) + `features/<feature>/hooks/` (loading / success / error, abort on unmount or
  dependency change).
- **Page-level data fetching.** Pages (`src/pages/<Name>Page/`) call the feature's data hooks
  (exported from the feature's `index.ts`) and pass the data, and callbacks such as `reload` or
  `onCreate`, down as props. Feature components only display: they never call a data hook or
  `useApiClient()` themselves (a form keeps its own UI state: field values, errors, "sending").
  Why: every API call of a page is visible in one file, so two components quietly loading the
  same list, or a list loaded again on every navigation inside the page, show up in review;
  components are easy to test (props in, markup out, no API mocks) and to reuse with other
  data. A component deep in the tree gets its data through props or `children` composition
  (`<Demo><DemoItems state={…} /></Demo>`); UI state shared by many components of a feature may live in a
  feature Context, but API data is still loaded by the page. There is
  no query cache (no TanStack Query): when two pages need the same data, each page loads it.
  Generated example: `pages/OverviewPage` calls `useItems()` and `useCreateItem()`, `DemoItems`
  and `AddItemForm` only display.
- Cookies, not tokens: requests to the BFF/API use the session cookie
  (`credentials: 'include'` when cross-origin) and send the CSRF header on state-changing
  requests ([auth-contract.md](auth-contract.md)). On 401 call `useAuth().refresh()`.
- Normalise response shapes in `api/` so hooks and components do not branch on transport details.

## State management

React only: `useState`, `useReducer` and Context. No Redux, Zustand, MobX or other state
library (none is in the catalog; adding one is a platform decision, not a feature decision).
Pick the smallest place that works:

| The state is…                                                         | Put it in                                                                                                      | Example                                                         |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| used by one component                                                 | `useState` (or `useReducer`) in that component                                                                 | a form's field values, an open/closed toggle                    |
| data from the API                                                     | the feature's data hook, called by the page ([Data fetching](#data-fetching)); **never copied into a Context** | `useItems()` in `OverviewPage`                                  |
| UI state shared by several components of one feature                  | a **feature Context** in `features/<name>/state/` (below)                                                      | selected items: a picker sets them, a summary shows them        |
| needed by every page of the remote                                    | an **app-level Context** in `src/state/` (same shape), passed to `createRemoteApp({ providers })`              | a remote-wide preference, a draft kept across pages             |
| owned by the shell (user, theme, settings)                            | host props (`useHostProps()`), `useAuth()`, `useTheme()`: never one remote reading another remote's state      | `useHostProps().user`                                           |
| shareable or bookmarkable (filters, search, sort, page, selected tab) | URL search params (`useSearchParams()` from `react-router`)                                                    | `?q=ada&dept=hr`: back button, reload and a pasted link keep it |

Feature (or app-level) state is a pure reducer plus a Context, one folder:

```
features/<name>/state/
  <name>Reducer.ts         state type, action union, initial state, pure reducer (no React, no API)
  <name>Reducer.test.ts    required (pnpm check rule state-test)
  <Name>Context.tsx        <NameProvider> (useReducer) + useNameState() + useNameDispatch()
  <Name>Context.test.tsx   the hooks under the provider, and the error outside it
```

- **Two contexts**, one for the state and one for `dispatch`: components that only dispatch
  (a button) do not re-render on every state change.
- **The hooks throw a clear error outside the provider** (`useNameState() must be used inside
<NameProvider>`), so a missing provider fails at once instead of rendering stale defaults.
- **Actions describe what happened** (`{ type: 'itemToggled', id }`), the reducer decides the
  new state; switch on `action.type` with a `never` check so a new action cannot be forgotten.
- Put the provider as low as possible: around the page (or the part of it) that uses the state.
  State needed by every page goes into `src/state/` and is passed to
  `createRemoteApp({ routes, providers: [AppProvider] })` (`@org/mf-runtime/remote`), which
  wraps the routes in both modes (embedded and standalone, inside the router and the host
  props).
- Everything a component needs from outside comes in through props, hooks of the feature or
  the host; never `window` globals, never another remote's modules.
- Generated example: `pnpm gen:remote <zone> <name> --state` adds `features/demo/state/`
  (`demoReducer.ts`, `DemoContext.tsx` and their tests) with `ItemPicker` (sets the selection)
  and `SelectionSummary` (shows and clears it) on the overview page.

## TypeScript

- `strict` everywhere. Avoid `any`; prefer explicit types and narrow unions.
- Treat external input as untrusted and validate at the boundary: API responses, URL params,
  storage, `postMessage`, manifest `props`, vendor events.
- Prefer the `@/` alias (`src/*`) over deep relative imports.

## Readability

- Clear over clever; short functions with one job; meaningful names (no `fN` for `firstName`).
- One identifier, one purpose; avoid shadowing.
- Extract repeated literals into constants and dense conditions into named booleans.
- DRY without over-abstracting. Destructure props and payloads.
- Comment intent, trade-offs and constraints, not what the code obviously does. Delete
  commented-out code.

## React

- Function components; pure render; hooks at the top level.
- Stable list keys (not array indexes when order can change).
- Composition (`children`, small components) over boolean-prop matrices. No `useMemo` /
  `useCallback` by default; use them for context values, callbacks passed to effects, and where
  this repo already does.

## Errors

- The UI stays usable: catch async work you own in `api/` / `hooks/`, return clear results and
  offer recovery (retry, back, safe empty state), never a blank screen.
- Never swallow errors silently. Prefer specific messages (operation + status).
- Render crashes: error boundaries (`<RemoteApp>` already wraps every remote).

## Input validation and forms

- Validate user input before side effects: required (reject blank/whitespace), formats (email,
  phone, date, id), numbers (no NaN, decimals, ranges), lengths.
- **Validate on submit**, not while the user types: the submit button stays enabled so pressing
  it always explains what is wrong. After a failed submit, re-validating a field on change or
  blur is fine (errors disappear as they are fixed).
- On a failed submit (client validation or a server `422`):
  - show an **error summary** above the form: a container with `role="alert"` (or focus moved to
    it with `tabIndex={-1}`), a heading such as "There is a problem", and one link per error
    pointing at the field (`href="#<field id>"`);
  - show the **field error** next to each field, referenced by the field's
    `aria-describedby`, and set `aria-invalid="true"` on the field;
  - move focus to the summary (or to the first invalid field when there is only one).
- Only **disable submit while sending** (`aria-busy` / "Saving…" text), to prevent double
  submits; re-enable it when the request finishes, whatever the result.
- Treat the server as the authority: map `HttpClientError.body.errors` (`{ "<field>": "<message>" }`
  from a 422) onto the same field errors and summary; show other failures as a form-level error
  with a retry.
- Build forms from the `@org/ui` field components and `Alert` ([Use @org/ui first](#use-orgui-first)).
- The generated remote's `features/demo` "Add item" form shows this pattern.

## Imports and naming

Order: React → external packages → `@org/*` → `@/…` → relative → styles. Prettier and ESLint
handle formatting.

| Kind         | Convention                           | Example                                      |
| ------------ | ------------------------------------ | -------------------------------------------- |
| Component    | PascalCase, in a folder of that name | `components/LeaveForm/LeaveForm.tsx`         |
| Styles       | same base + `.module.scss`           | `components/LeaveForm/LeaveForm.module.scss` |
| Hook         | `use` + camelCase                    | `hooks/useLeaveBalance.ts`                   |
| API function | camelCase verb                       | `api/leaveApi.ts` (`getLeaveBalance`)        |
| Types        | under `types/`                       | `types/leave.ts`                             |
| Helpers      | camelCase, under `utils/`            | `utils/validateLeave.ts`                     |
| Unit test    | co-located                           | `components/LeaveForm/LeaveForm.test.tsx`    |
| Test data    | feature `__fixtures__/`              | `__fixtures__/leave.ts`                      |
| e2e spec     | shell `e2e/`                         | `e2e/leave-requests.spec.ts`                 |

Package names: apps `@org/<zone>-<name>` / `@org/shell-<name>` (generated); shared packages
`@org/<name>` (never with an app prefix).

## Styling

- CSS Modules (`*.module.scss`) in the component's folder, one per component, never shared
  ([One folder per component](#one-folder-per-component)); tokens (`var(--…)`) for colours,
  spacing, radius, shadow. No hardcoded colours on themeable surfaces; both themes must pass contrast.
- Global styles only in the shell (and a remote's standalone entry, `src/main.tsx`). The shell's own global
  rules live in `src/styles/shell.scss` (imported after `@org/design-tokens/global.scss`). The
  header colours are not global: they are in the shell's own
  `src/layouts/ShellLayout/ShellLayout.module.scss`
  ([ui-context.md](ui-context.md#header-colours)). Remotes never set custom properties for the
  whole page (`:root`, `html`, `body`, `[data-theme]`; `pnpm check` rule `remote-global-tokens`).
- Never select another package's CSS Module class names (e.g. `@org/ui`'s `.skipLink`): they
  carry a per-app hash (`SkipLink_skipLink__x3Yb1`). Pass a `className` to the building block, or use tokens.
- See [ui-context.md](ui-context.md).

## Testing

- Unit: Jest + Testing Library, co-located; every component has `<Name>.test.tsx`; assert
  user-visible behaviour (data, empty/loading/error states, accessible names), not snapshots;
  mock boundaries (`api/`, `@org/mf-runtime`), not DOM internals. Shared test data in the
  feature's `__fixtures__/`.
- e2e: the zone suite in the shell; feature flows as new specs there.
- Details and commands: [testing.md](testing.md).

## Lint & format

- `pnpm lint` (guardrails + ESLint), `pnpm format` / `pnpm format:check` (Prettier). Format on
  save via `.vscode/settings.json` and the recommended extensions.

## Anti-patterns

- Hardcoded API hosts/paths or app paths in components.
- Build-time environment config (`.env`, `DefinePlugin` URLs) instead of the manifest.
- Tokens, secrets or personal data (NRIC, email, phone) in client code, storage or logs.
- A remote importing another remote, a shell importing a remote, a package importing an app.
- A second copy of a tier-1 library, or a library with React context that is not tier 1.
- `dangerouslySetInnerHTML` with untrusted content; `eval`/`new Function`.
- Broad `console.log` in production paths.
- Undocumented globals for host/embed detection (use `useHostProps().embedded`).
- One `.module.scss` shared by several components, component files loose in `components/` or a
  feature root, a component without a test.
- A global store library (Redux, …), API data copied into a Context, filters kept in state
  when they belong in the URL, a Context hook that silently works without its provider.
- Expanding scope beyond the requested change; prefer small, incremental changes.
- Commits only when asked; never commit secrets.
