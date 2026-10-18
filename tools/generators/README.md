# @org/generators

Creates apps from templates. Run from the repo root:

```sh
pnpm gen:shell <zone> [--title "<text>"]                # zone: intranet | internet
pnpm gen:remote <zone> <name> [--private] [--external [--vendor-format esm|web-component|script]] [--title "<text>"]
                                                        # name: kebab-case, e.g. staff-directory
pnpm install
pnpm dev:<zone>
```

| Generator    | Creates                                                                                | Package              | Federation name | Port                                            |
| ------------ | -------------------------------------------------------------------------------------- | -------------------- | --------------- | ----------------------------------------------- |
| `gen:shell`  | `apps/<zone>/shell-<zone>` (incl. the zone's e2e suite in `e2e/`)                      | `@org/shell-<zone>`  | `<zone>_shell`  | first of the zone (3100/3200)                   |
| `gen:remote` | `apps/<zone>/<name>` + entry in the shell's `remotes.json` and `mfe-manifest.dev.json` | `@org/<zone>-<name>` | `<zone>_<name>` | lowest free in the zone (3101–3189 / 3201–3289) |

- **Titles** (nav label, `<h1>`, `APP_TITLE`) are derived from the name in **sentence case**,
  with a short list of acronyms kept in capitals (`TITLE_ACRONYMS` in `src/names.js`: IT, HR,
  API, FAQ, ID, UI, UX, URL, PDF, SMS): `staff-directory` → "Staff directory", `it-helpdesk` →
  "IT helpdesk"; the shell is "Intranet shell" / "Internet shell". `--title "Staff portal"`
  overrides it (max 60 characters; no quotes, backslashes, `<>`, `{}` or `$`: use ’ for
  apostrophes). Change it later in `src/core/constants/app.ts` and the shell's `remotes.json`.

- Non-interactive. Never overwrites: an existing folder, package name or registry entry is an
  error. `gen:remote` needs the zone's shell (`pnpm gen:shell <zone>` first).
- `--private`: tag `access:private` and `"access": "private"` in the shell registry. The shell
  wraps its route in `<RequireAuth>` (`@org/auth`): signed-out users get a sign-in prompt and the
  remote is not downloaded before sign-in. Every remote receives host prop `user`.
- Shells always render `<AuthProvider>`; the client comes from the manifest's `auth` section
  (`mfe-manifest.dev.json` gets `"auth": { "mock": true }`, the dev-only mock sign-in). See
  `docs/auth-contract.md`.
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
  shell's dev manifest gets `settings.apiBaseUrl: http://localhost:<3190|3290>/api`. Tool ports
  come from the zone's tools range and the root `package.json` `mfe.tools` (`toolPort()` in
  `tools/scripts/src/zones.js`), so `pnpm dev:intranet` and `pnpm dev:internet` run side by side.
- The remote's demo feature (`src/features/demo`) loads `/items` from that API through
  `@org/http-client` (api/ → hooks/ → components) and has an "Add item" form with the
  validate-on-submit / error-summary pattern (docs/coding-conventions.md).
- Every generated feature uses **one folder per component** (docs/coding-conventions.md):
  `features/<feature>/components/<Name>/{<Name>.tsx, <Name>.module.scss, <Name>.test.tsx, index.ts}`,
  non-component code in `api/`, `hooks/`, `types/`, `utils/`. Remote: `features/demo`
  (`Demo`, `DemoDetails`, `DemoItems`, `AddItemForm`; `utils/validation.ts`). Shell:
  `features/welcome` (`Welcome`), `features/startup` (`StartupError`). Adapter:
  `features/external` (`ExternalModuleHost`; `utils/vendorConfig.ts`). `pnpm check` keeps it
  that way.
- Shells get `src/styles/shell.scss`, the shell's own global stylesheet, imported in
  `src/bootstrap.tsx` right after `@org/design-tokens/global.scss`. It holds the header colour
  tokens (`--header-bg`, `--header-text`, `--header-text-muted`, `--header-border`,
  `--header-accent`) per theme, commented out (default header) with a blue example. Remotes do
  not get one and must not set those tokens (`pnpm check`). See `docs/ui-context.md` "Header
  colours per shell".
- Metadata in the generated `package.json`: `nx.tags` (`zone:`, `type:`, `access:`, `kind:`) and
  `mfe` (`port`, `federationName`). `rspack.config.js` reads `mfe` from `package.json`.
- Dependencies: `catalog:` for third-party packages, `workspace:*` for `@org/*`.
- Shells get the zone's e2e suite: `playwright.config.ts` (`@org/playwright-config`) and
  `e2e/*.spec.ts`, which iterate `remotes.json` (deep links, private guard, external adapters
  with any vendor + mock-vendor extras, standalone remotes, one-row header at 320–1280 px (signed in and out; long brand truncates on one line) with the Menu disclosure, axe WCAG
  2.2 AA in light and dark) with the helpers `openNav`, `openHeaderMenu` and `settle`. `pnpm e2e:<zone>` runs it. Remotes get no
  e2e folder of their own: their standalone mode is covered by the zone suite. See
  `docs/testing.md`.
- Generated files are formatted with the repo's Prettier config.

Templates live in `templates/shell`, `templates/remote` and `templates/external` (an overlay on
`remote`). Files end in `.tmpl` (so the repo's tools ignore them) and use `__TOKEN__` placeholders
(`__ZONE__`, `__NAME__`, `__APP_TITLE__`, `__PACKAGE_NAME__`, `__FEDERATION_NAME__`,
`__ROUTE_PATH__`, `__PORT__`, `__SHELL_PORT__`, `__ACCESS__`, `__DIR_NAME__`, `__MOCK_API_URL__`,
`__MOCK_VENDOR_PORT__`, `__MOCK_VENDOR_URL__`, `__MOCK_VENDOR_CONFIG__` (JSON),
`__VENDOR_FORMAT__`). An unknown token is an error.

Tests (`pnpm --filter @org/generators test`) generate both zones into a temp workspace and run
`check-apps` / `check-versions` on the result. The full proof (install, lint, typecheck, test,
build, browser) is done in a throwaway copy of the repo; apps are never committed to the
template.
