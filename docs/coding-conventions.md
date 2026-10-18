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

| What                   | Where                                                                                                                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A new app              | `pnpm gen:shell` / `pnpm gen:remote` ([adding-an-app.md](adding-an-app.md)); never copy an app folder                                                                                           |
| Code used by 2+ apps   | a package in `packages/` (tag `type:package`), `workspace:*` dependency                                                                                                                         |
| Code used by one app   | that app's `src/`                                                                                                                                                                               |
| Build/test/lint config | the shared config packages (`@org/rspack-config`, `@org/jest-config`, `@org/playwright-config`, `@org/eslint-config`, `@org/tsconfig`, `@org/prettier-config`); apps keep one-line config files |
| Repo tooling           | `tools/`                                                                                                                                                                                        |

Hard rules (enforced by `pnpm check` and ESLint, see [guardrails.md](guardrails.md)):

- A shell never imports a remote; a remote never imports another remote or a shell; the zones
  share only `packages/*`.
- Packages never import apps.
- Every package declares what it imports (isolated `node_modules`, D7). Dependency versions
  follow the tiers in [adding-dependencies.md](adding-dependencies.md).

## Layers inside an app

| Layer                  | Role                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| `src/main.tsx`         | `import('./bootstrap')` only (Module Federation negotiates the shared singletons first)             |
| `src/bootstrap.tsx`    | Shell: global styles, PWA, manifest, auth client, render. Remote: standalone entry only             |
| `src/app/`             | Wiring: providers, routes, registry (shell); `RemoteApp` (exposed `./App`), `apps`, routes (remote) |
| `src/features/<name>/` | Domain UI + `api/` / `hooks/` / `types/`, public `index.ts`                                         |
| `src/pages/`           | Thin route containers that compose features                                                         |
| `src/components/`      | UI primitives of this app (shared ones go to `@org/ui`)                                             |
| `src/layouts/`         | Chrome (`ShellLayout`, `StandaloneLayout`)                                                          |
| `src/core/`            | Constants (`routePaths`, `apiRoutes`, `app`), types, small utils (no parallel `lib/`)               |
| `src/services/`        | App-wide infra (`http` client)                                                                      |

**Rule of thumb:** pages compose, features own domain data, components stay presentational,
core holds constants, services own HTTP.

New capability: `features/<name>/` (types → api → hooks → UI) → thin `pages/` entry → route in
`app/routes.tsx` using `routePaths`.

## Remotes

- `src/app/RemoteApp.tsx` (exposed `./App`) must not import global styles
  (`@org/design-tokens/global.scss`) or register a service worker; a unit test walks its import
  graph to enforce this.
- Routes are relative (they match below the shell's `/<remote>/*` and from `/` standalone).
  Links between pages use `useRemotePath()` from `@org/mf-runtime/remote`, never hardcoded
  absolute paths.
- Read host data from `useHostProps()` (`user`, `settings`, `basePath`, manifest `props`).
  `useAuth()` from `@org/auth` gives the shell's session (`csrfToken`, `refresh()` after a 401).
- Both modes must keep working: embedded in the shell and standalone with
  `standaloneProps` (mock host props).

## Shells

- Remotes appear only through `remotes.json` (registry) and the manifest; no remote code, no
  remote package dependency.
- Private remotes are wrapped in `<RequireAuth>` by `RemotePage`; do not render a private
  remote anywhere else.
- Runtime configuration (API base URL, feature settings) comes from the manifest's `settings`,
  never from build-time constants or `.env` files.

## Data fetching

- Do **not** hardcode API paths in components: define them in `core/constants/apiRoutes.ts`
  (`defineApiRoutes`) and call them through the app's `services/http.ts`
  (`createHttpClient` from `@org/http-client`, base URL from `settings.apiBaseUrl`).
- Do **not** hardcode app paths: use `routePaths` / `useRemotePath()`.
- Do **not** call APIs in a component's `useEffect`. Use `features/<feature>/api/` (pure request
  functions) + `features/<feature>/hooks/` (loading / success / error, abort on unmount or
  dependency change). Components render from hooks/props.
- Cookies, not tokens: requests to the BFF/API use the session cookie
  (`credentials: 'include'` when cross-origin) and send the CSRF header on state-changing
  requests ([auth-contract.md](auth-contract.md)). On 401 call `useAuth().refresh()`.
- Normalise response shapes in `api/` so hooks and components do not branch on transport details.

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
- The generated remote's `features/demo` "Add item" form shows this pattern.

## Imports and naming

Order: React → external packages → `@org/*` → `@/…` → relative → styles. Prettier and ESLint
handle formatting.

| Kind         | Convention                 | Example                      |
| ------------ | -------------------------- | ---------------------------- |
| Component    | PascalCase                 | `LeaveForm.tsx`              |
| Styles       | same base + `.module.scss` | `LeaveForm.module.scss`      |
| Hook         | `use` + camelCase          | `useLeaveBalance.ts`         |
| API function | camelCase verb             | `getLeaveBalance.ts`         |
| Types        | under `types/`             | `types/leave.ts`             |
| Unit test    | co-located                 | `LeaveForm.test.tsx`         |
| e2e spec     | shell `e2e/`               | `e2e/leave-requests.spec.ts` |

Package names: apps `@org/<zone>-<name>` / `@org/shell-<zone>` (generated); shared packages
`@org/<name>` (never with an app prefix).

## Styling

- CSS Modules (`*.module.scss`) next to the component; tokens (`var(--…)`) for colours, spacing,
  radius, shadow. No hardcoded colours on themeable surfaces; both themes must pass contrast.
- Global styles only in the shell (and a remote's standalone bootstrap).
- See [ui-context.md](ui-context.md).

## Testing

- Unit: Jest + Testing Library, co-located; assert user-visible behaviour; mock boundaries
  (`api/`, `@org/mf-runtime`), not DOM internals.
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
- Expanding scope beyond the requested change; prefer small, incremental changes.
- Commits only when asked; never commit secrets.
