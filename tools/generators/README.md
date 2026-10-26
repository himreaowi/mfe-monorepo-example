# @org/generators

Creates apps and code libraries from templates. Run from the repo root:

```sh
pnpm gen:shell <zone> [--layout top|side] [--title "<text>"]   # zone: intranet | internet
pnpm gen:remote <zone> <name> [--private] [--external [--vendor-format esm|web-component|script]] [--title "<text>"]
                                                        # name: kebab-case, e.g. staff-directory
pnpm gen:package <common|zone> <capability>             # a library, docs/where-code-goes.md
pnpm install
pnpm dev:<zone>
```

| Generator     | Creates                                                                                                                                                                                                                                                                                                                                      | Package                                                 | Federation name                                          | Port                                            |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------- |
| `gen:shell`   | `apps/<zone>/<name>/shell` (name default: the zone; `--base-path`, default `/`; incl. its e2e suite in `e2e/`)                                                                                                                                                                                                                               | `@org/shell-<name>`                                     | `<zone>_shell` (name = zone), else `<zone>_shell_<name>` | lowest free shell port (3101–3109 / 3201–3209)  |
| `gen:remote`  | `apps/<zone>/<shell>/<name>` (`apps/<zone>/shared/<name>` when `--shell a,b`) + entry in the `remotes.json` of the zone's shell, or of each `--shell` (regenerates their `mfe-manifest.dev.json`)                                                                                                                                            | `@org/<zone>-<name>`                                    | `<zone>_<name>`                                          | lowest free remote port (3110–3189 / 3210–3289) |
| `gen:package` | `packages/common/<capability>` (`common`) or `apps/<zone>/libs/<capability>` (a zone): package.json (platform configs as `workspace:*`, tags `type:common` / `zone:<zone>` + `type:lib`), tsconfig, eslint/jest configs, README, `src/index.ts`, a sample function + test. Common packages carry the "ships to the internet portals" warning | `@org/common-<capability>` / `@org/<zone>-<capability>` |                                                          |                                                 |

Several shells per zone: `pnpm gen:shell internet citizen --base-path /citizen`, then
`pnpm gen:shell internet business --base-path /business --layout side`; the first shell below a
base path (no shell at `/`) becomes the zone's default shell in the root `package.json`
(`mfe.zones.<zone>.defaultShell`). `pnpm gen:remote` then needs `--shell <name>` (repeatable or
comma-separated: `--shell citizen,business`).

- **Titles** (nav label, `<h1>`, `APP_TITLE`) are derived from the name in **sentence case**,
  with a short list of acronyms kept in capitals (`TITLE_ACRONYMS` in `src/names.js`: IT, HR,
  API, FAQ, ID, UI, UX, URL, PDF, SMS): `staff-directory` → "Staff directory", `it-helpdesk` →
  "IT helpdesk"; the shell is "Intranet shell" / "Internet shell". `--title "Staff portal"`
  overrides it (max 60 characters; no quotes, backslashes, `<>`, `{}` or `$`: use ’ for
  apostrophes). Change it later in `src/core/constants/app.ts` and the shell's `remotes.json`.

- **`--layout top|side`** (`gen:shell`, default `top`): which **starter layout** is copied into
  the shell as its own code: `templates/shell-layouts/<layout>/` →
  `src/layouts/ShellLayout/{ShellLayout.tsx, ShellLayout.module.scss, ShellLayout.test.tsx}`
  `top`: remotes nav in the header row; `side`: a
  sticky top bar and the nav in a sidebar left of the content. On narrow screens both fold the
  nav behind "Menu" (the side starter as a drawer). After generation there is no layout option
  anywhere: the team edits the files (colours in the "HEADER COLOURS" block of
  `ShellLayout.module.scss`). Both starters are built from `@org/ui` building blocks and set the
  hooks the generated e2e suite relies on (`data-testid` `main-header` with `data-layout` and
  `data-nav-placement`, `header-brand`, `header-menu-button`, `header-panel`; listed at the top
  of `e2e/helpers.ts`), so the same suite checks either layout. See `docs/ui-context.md`
  "Layout: the shell owns it". `gen:remote --layout` is an error (the shell owns the layout).
- Non-interactive. Never overwrites: an existing folder, package name or registry entry is an
  error. `gen:remote` needs the zone's shell (`pnpm gen:shell <zone>` first).
- `--private`: tag `access:private` and `"access": "private"` in the shell registry. The shell
  wraps its route in `<RequireAuth>` (`@org/auth`): signed-out users get a sign-in prompt and the
  remote is not downloaded before sign-in. Every remote receives host prop `user`.
- Shells always render `<AuthProvider>`; the client comes from the manifest's `auth` section
  (the shell's `package.json` `mfe.devManifest` has `"auth": { "mock": true }`, the dev-only mock
  sign-in, and `settings.apiBaseUrl` → the shell's same-origin `<base>/api`, which the dev proxy forwards to
  the zone's mock API unless `API_UPSTREAM` says otherwise). See
  `docs/auth-contract.md`.
- `--state` (`gen:remote`, not with `--external`): adds the **feature-state example** from
  `templates/remote-state/`: `src/features/demo/state/` (`demoReducer.ts` + test,
  `DemoContext.tsx` with `DemoProvider`, `useDemoState()`, `useDemoDispatch()` + test) and two
  components that share it on the overview page (`ItemPicker` sets the selected items,
  `SelectionSummary` shows and clears them). See docs/coding-conventions.md "State management".
- `--external`: an **adapter remote** for a vendor module (tag `kind:external`, registry
  `"kind": "external"`). `src/features/external/components/ExternalModuleHost/` renders
  `<ExternalModule>` (`@org/mf-runtime/external`) configured from the remote's manifest
  `props.vendor` (URL per environment); one splat route, so the vendor routes on `props.path`.
  The dev manifest entry points at the zone's mock vendor (`tools/mock-vendor`, intranet :3191,
  internet :3291) with a generic config (`{ "title": "<Title> (mock vendor)" }`), the adapter
  falls back to it in development builds, and its `nx.targets.dev.dependsOn` starts it with
  `pnpm dev:<zone>`. `--vendor-format` picks the mock vendor's delivery format: `esm`
  (default, `/mount.js`), `web-component` (`/element.js`, `tagName`), `script` (`/script.js`,
  `global`); `mf` is refused (the mock cannot serve an MF remote: generate `esm` and edit
  `props.vendor`). The demo feature and details page are not generated. See
  `docs/external-modules.md`.
- **Dev tools per zone**: every generated app's `nx.targets.dev.dependsOn` starts the zone's
  mock API (`@org/mock-api`, target `serve:<zone>`; adapters also `@org/mock-vendor`), and the
  shell's dev manifest gets `settings.apiBaseUrl: <base path>/api` (proxied to
  `http://localhost:<3190|3290>/api` by default; `.env.example` files are created, see
  `docs/configuration.md`). Tool ports
  come from the zone's tools range and the root `package.json` `mfe.tools` (`toolPort()` in
  `tools/scripts/src/zones.js`), so `pnpm dev:intranet` and `pnpm dev:internet` run side by side.
- The remote's demo feature (`src/features/demo`) loads `/items` from that API through
  `useApiClient()` (api/ → hooks/ → the page, which passes data down → display-only components) and has an "Add item" form with the
  validate-on-submit / error-summary pattern (docs/coding-conventions.md).
- Every generated feature uses **one folder per component** (docs/coding-conventions.md):
  `features/<feature>/components/<Name>/{<Name>.tsx, <Name>.module.scss, <Name>.test.tsx}` (no
  `index.ts`: imports name the file; a feature's `index.ts` is its public API),
  non-component code in `api/`, `hooks/`, `types/`, `utils/`. Remote: `features/demo`
  (`Demo`, `DemoDetails`, `DemoItems`, `AddItemForm`; `utils/validation.ts`). Shell:
  `features/welcome` (`Welcome`), `features/startup` (`StartupError`) and
  `layouts/ShellLayout`; remotes `layouts/StandaloneLayout`. Adapter:
  `features/external` (`ExternalModuleHost`; `utils/vendorConfig.ts`). `pnpm check` keeps it
  that way.
- Shells get `src/styles/shell.scss`, the shell's own global stylesheet (empty by default, for
  fonts or a shell-wide token override), imported in `src/main.tsx` right after
  `@org/design-tokens/global.scss`. The header colours are not there: they are in the copied
  `ShellLayout.module.scss`. Remotes get their own small `src/layouts/StandaloneLayout/`
  (standalone mode only) and must not set page-wide custom properties (`pnpm check` rule
  `remote-global-tokens`).
- Metadata in the generated `package.json`: `nx.tags` (`zone:`, `type:`, `access:`, `kind:`) and
  `mfe` (`port`, `federationName`). `webpack.config.js` reads `mfe` from `package.json`.
- Dependencies: `catalog:` for third-party packages, `workspace:*` for `@org/*`.
- Shells get the zone's e2e suite: `playwright.config.ts` (`@org/playwright-config`) and
  `e2e/*.spec.ts`, which iterate `remotes.json` (deep links, private guard, external adapters
  with any vendor + mock-vendor extras, standalone remotes, one-row header at 320–1280 px (signed in and out; long brand truncates on one line) with the Menu disclosure, axe WCAG
  2.2 AA in light and dark, landmarks + skip link + keyboard order; with the side layout
  (`data-nav-placement="side"`) also the sidebar from 896 px, the drawer below it and the
  sticky top bar) with the helpers
  `openNav`, `openHeaderMenu`, `navPlacement`, `expectSidebar`, `expectDrawer` and `settle`. `pnpm e2e:<zone>` runs it. Remotes get no
  e2e folder of their own: their standalone mode is covered by the zone suite. See
  `docs/testing.md`.
- Generated files are formatted with the repo's Prettier config.

Templates live in `templates/shell`, `templates/shell-layouts/top|side` (an overlay on `shell`:
the starter layout), `templates/remote`, `templates/remote-state` (an overlay on `remote` for `--state`) and `templates/external` (an overlay on `remote`). Files end in `.tmpl` (so the repo's tools ignore them) and use `__TOKEN__` placeholders
(`__ZONE__`, `__NAME__`, `__APP_TITLE__`, `__SHELL_LAYOUT__`, `__PACKAGE_NAME__`, `__FEDERATION_NAME__`,
`__ROUTE_PATH__`, `__PORT__`, `__SHELL_PORT__`, `__ACCESS__`, `__DIR_NAME__`, `__MOCK_API_URL__`,
`__MOCK_VENDOR_PORT__`, `__MOCK_VENDOR_URL__`, `__MOCK_VENDOR_CONFIG__` (JSON),
`__VENDOR_FORMAT__`). An unknown token is an error.

Tests (`pnpm --filter @org/generators test`) generate both zones into a temp workspace and run
`check-apps` / `check-versions` on the result. The full proof (install, lint, typecheck, test,
build, browser) is done in a throwaway copy of the repo; apps are never committed to the
template.
