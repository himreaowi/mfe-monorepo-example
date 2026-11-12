# Maintaining the template (handover)

For whoever changes the **structure** of this boilerplate: shared packages, generators, check
rules, folder layout, tooling versions. Teams that only build apps need
[getting-started.md](getting-started.md) and [adding-an-app.md](adding-an-app.md) instead.

This guide is identical in both repos. Written 2026-11-12, when maintenance moved to another
laptop.

## 1. The two repos

| Repo                                                                        | What it is                                                                                       |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [mfe-monorepo-template](https://github.com/himreaowi/mfe-monorepo-template) | The boilerplate. `apps/` is empty; generators create apps.                                       |
| [mfe-monorepo-example](https://github.com/himreaowi/mfe-monorepo-example)   | The same template plus real sample apps (Staff, Citizen, Business portals). Proves it all works. |

**The example is a copy of the template with apps on top.** Everything outside `apps/` (packages,
tools, docs, deploy, root config) must stay the same in both, except the example's docs and
READMEs, which mention its real apps.

**Rule: change the template first, then copy the change to the example.** Never fix something
only in the example: new projects start from the template and would miss it.

## 2. Setting up a new laptop

```bash
git clone https://github.com/himreaowi/mfe-monorepo-template.git
git clone https://github.com/himreaowi/mfe-monorepo-example.git
cd mfe-monorepo-template
nvm install          # installs the exact Node in .nvmrc
nvm use
corepack enable      # pnpm comes from package.json "packageManager"
pnpm install
```

Repeat `nvm use` + `pnpm install` in the example. For e2e (example only), once per machine:

```bash
pnpm --filter @org/shell-staff exec playwright install chromium
```

**Screenshot tests:** saved screenshots are per operating system
(`packages/platform/ui/visual/__screenshots__/darwin/` = macOS). On a non-Mac laptop the first
`pnpm test:ui` has nothing to compare against: run `pnpm test:ui:update` once, check the new
images by eye, and commit them.

## 3. Golden rules

1. **Template first, example second** (section 7 shows how to copy).
2. **Run every command from inside the repo folder, after `nvm use`.** From another folder you get
   the wrong Node (Node 20 breaks the tools) and pnpm misses the workspace settings.
3. **Never commit environment addresses.** No UAT/staging/production hostnames, no `.env` files
   (only `.env.example`). DevOps sets addresses as variables. `pnpm check` blocks committed
   `.env` files.
4. **Never commit the `"analytics": false` line that Nx adds to `nx.json`.**
5. **Exact versions only** in the `catalog:` of `pnpm-workspace.yaml` (no `^`). See
   [adding-dependencies.md](adding-dependencies.md) for the three tiers.
6. **One branch per change** (`feat/...`, `fix/...`, `chore/...`), same name in both repos. When
   everything passes, fast-forward `main` and push both repos.
7. **Do not stop dev servers you did not start.** Ports 3100–3299 are the dev servers'; if they are
   busy, ask before running e2e.

## 4. Where things live

| What                                                                                                | Where                                                                                                   |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Shared plumbing (UI, auth, HTTP, query, MF runtime, webpack/jest/eslint/tsconfig/playwright config) | `packages/platform/*` (names `@org/ui`, `@org/auth`, …)                                                 |
| Public business logic for both zones                                                                | `packages/common/<capability>` (`@org/common-<capability>`)                                             |
| Apps                                                                                                | `apps/<zone>/<portal>/{shell,<remote>}`, `apps/<zone>/shared/<remote>`, `apps/<zone>/libs/<capability>` |
| What new apps look like                                                                             | `tools/generators/templates/{shell,shell-layouts,remote,remote-state,external,package}`                 |
| Generator logic and flags                                                                           | `tools/generators/src/index.js`, `tools/generators/bin/gen.js`                                          |
| `pnpm check` rules                                                                                  | `tools/scripts/src/check-{apps,packages,versions,env}.js`, tiers in `tools/scripts/src/tiers.js`        |
| Zones and port blocks                                                                               | `tools/scripts/src/zones.js` (zones are fixed: `intranet`, `internet`)                                  |
| Dev proxy, dev manifest, move helpers                                                               | `tools/scripts/src/{zone-proxy,dev-manifest,move-remote,move-component}.js`                             |
| Tool ports, allowed duplicate components                                                            | root `package.json` → `mfe.tools`, `mfe.componentDuplicatesAllowed`                                     |
| Versions                                                                                            | `pnpm-workspace.yaml` (`catalog:`), `.nvmrc`, `deploy/Dockerfile`                                       |
| Loaded-once shared libraries (tier 1)                                                               | `tools/scripts/src/tiers.js` **and** `packages/platform/webpack-config/src/tier1.js` (must match)       |
| Containers, nginx, security headers                                                                 | `deploy/`                                                                                               |
| Docs                                                                                                | `docs/`, `README.md`, `AGENTS.md`, `.specify/` (Spec Kit)                                               |

## 5. Recipes for structural changes

Each recipe ends with "verify" = the checklist in section 6.

### A shared package (`packages/platform/*`, e.g. a `@org/ui` component)

1. Change the package and its tests. `@org/ui` components: one folder with `.tsx`,
   `.module.scss`, `.test.tsx`, `.stories.tsx` (`pnpm check` enforces it).
2. Base UI (`@base-ui/react`) may only be imported inside `packages/platform/ui`, by subpath
   (`@base-ui/react/dialog`). Wrap parts that could add `<style>` in
   `<CSPProvider disableStyleElements>`.
3. Run `pnpm test:ui`; if screenshots change on purpose, `pnpm test:ui:update` and check them.
4. Update `packages/platform/<name>/README.md`. Verify, then copy to the example.

### Adding an icon (`@org/ui`)

1. Ask the designer for a 24×24 SVG. Keep only the shapes; strip fixed colours, `width`/`height`,
   ids and `<title>` (filled shapes: `fill="currentColor" stroke="none"`).
2. `packages/platform/ui/src/icons/<Name>Icon.tsx`, one `export function <Name>Icon` built on
   `Icon` (copy `CloseIcon.tsx`). `pnpm check` rule `icon-files` checks name, export and colours.
3. Export it from `src/index.ts`, add it to `ICONS` in `src/components/Icon/Icon.stories.tsx`,
   `pnpm test:ui:update`, review the Components/Icons screenshots. Verify, copy to the example.

### What new apps look like (generators)

1. Edit the files under `tools/generators/templates/...` (`.tmpl` files; tokens like `__PACKAGE_NAME__`
   and `__ZONE__` are filled in by `src/index.js`).
2. New flag: add it in `src/index.js` (validation) and `bin/gen.js` (help text), and a test in
   `tools/generators/test/generators.test.js`.
3. **Prove it:** generate throwaway apps (a shell, a remote, a `--state` and an `--external`
   remote, plus any new flag), run `pnpm install`, their typecheck/lint/test, then delete them,
   `git checkout pnpm-lock.yaml`, and restore `apps/.gitkeep` if it went.
4. Existing apps in the example are **not** regenerated: make the same change in them by hand
   (they are customised copies). List the steps in the commit message.

### A `pnpm check` rule

1. Change `tools/scripts/src/check-*.js` and its test in `tools/scripts/test/`.
2. Add or update the row in [guardrails.md](guardrails.md) (message + fix).
3. Run `pnpm check` in **both** repos: the example has real apps the rule may now flag.

### App folder layout

The flat layout (`src/{app,pages,components,hooks,api,state,types,utils,__fixtures__,layouts,core}`,
no `features/`, no `index.ts`) is enforced by `check-apps.js` (`barrel-file`, `component-folder`,
`state-test`, `shared-component`). A layout change touches: generator templates, those rules
and tests, `move-component`, [coding-conventions.md](coding-conventions.md),
[where-code-goes.md](where-code-goes.md), then every example app (`git mv` to keep history).

### Dependencies and versions

- Adding or upgrading: [adding-dependencies.md](adding-dependencies.md). Exact version in the
  catalog, `pnpm install`, verify.
- A new loaded-once (tier 1) library: add it to **both** `tiers.js` and `tier1.js`, restart dev
  servers.
- **Node:** change `.nvmrc` and `ARG NODE_IMAGE` in `deploy/Dockerfile` together, and the
  version in [toolchain.md](toolchain.md). On each laptop: `nvm install`, `nvm use`, then
  **`corepack enable`** again (each Node version has its own `pnpm` shim).
- **webpack stays at 5.111.1** until `@module-federation/enhanced` supports 5.112 (see
  [toolchain.md](toolchain.md)).

### Sign-in

- For all portals: `packages/platform/auth` (`SignInGate`, `RequireAuth`, `UserMenu`).
- Per portal: the shell's `src/core/constants/signIn.ts`, `src/pages/LandingPage`, and the
  `SIGNED-OUT HEADER` spot in `ShellLayout.tsx`.
- The backend contract is [auth-contract.md](auth-contract.md); never put sign-in logic in remotes.

### Dev server or webpack settings

Anything in `packages/platform/webpack-config` that affects `webpack serve` is only proven by a
**freshly started** dev server or e2e run (running dev servers keep the old settings). See the
pitfall about the dev overlay in section 8.

## 6. Verify (every change, both repos)

```bash
pnpm check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
pnpm test:ui          # @org/ui accessibility + screenshots (port 3193)
CI=1 pnpm e2e         # example only; needs ports 3100–3299 free, 10–15 minutes
```

`CI=1` makes e2e start its own fresh servers. Without it, e2e reuses dev servers that are already
running (handy, but they may run old settings).

Expected in the example (Node 24.22.3, 2026-11-12): Staff 127 passed / 7 skipped, Business 81 / 5,
Citizen 132 / 10. One known flaky test: "Corppass mock sign-in…" on the phone size in the Business
suite sometimes needs its automatic retry.

## 7. Copying a template change to the example

With both repos on the same branch name:

```bash
cd mfe-monorepo-example
git -C ../mfe-monorepo-template diff --binary main..<branch> -- . ':!pnpm-lock.yaml' \
  | git apply --3way
pnpm install
diff -rq -x node_modules -x dist -x storybook-static -x test-results \
  ../mfe-monorepo-template/packages/platform packages/platform
```

Expect no output except `packages/platform/ui/README.md` (the example's Storybook port differs).

- Conflicts are usually in docs/READMEs that mention the example's apps: keep the example's
  wording and add the change.
- Then adapt the example's apps by hand where the change affects them, and run the full verify.

## 8. Pitfalls we hit (so you don't)

| Pitfall                                                                                                                                                                           | Rule                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| A **function** in webpack-dev-server options (e.g. `client.overlay.runtimeErrors`) is run from a string in the browser; the strict dev CSP blocks it and **every page is blank**. | Plain values only. A test in `webpack-config/src/config.test.js` checks this.                                  |
| Base UI **Combobox** and **Select** hide the rest of the page from screen readers while open.                                                                                     | Combobox is hand-built; Select stays native. Always run axe with popups open.                                  |
| Changing layout inside a `ResizeObserver` callback → "ResizeObserver loop" error.                                                                                                 | Apply the change on the next animation frame (see `useFitLayout`).                                             |
| webpack 5.112 breaks Module Federation 2.9.2.                                                                                                                                     | Keep 5.111.1 (section 5).                                                                                      |
| Node 20 breaks the tools (`util.parseEnv`, `fs.globSync`).                                                                                                                        | `nvm use` inside the repo.                                                                                     |
| After a Node upgrade: `Cannot find module …/corepack/pnpm/<version>/bin/pnpm.cjs`.                                                                                                | The new Node has no `pnpm` shim yet, so an old one is used: `nvm use`, `corepack enable`, open a new terminal. |
| zsh does not split `$FILES` into words in scripts.                                                                                                                                | Use arrays or list paths one by one.                                                                           |
| `git push` fails with "unexpected disconnect" on large pushes.                                                                                                                    | `git -c http.postBuffer=524288000 -c http.version=HTTP/1.1 push`.                                              |
| Remote bundles are public files.                                                                                                                                                  | `access: 'private'` and sign-in-required are UX, not security; the backend checks every call.                  |

## 9. Open items and ideas (not done)

- **Simplification options** (assessed 2026-11-11, none started): A remove vendor/external modules
  (~4,450 lines) if no vendor apps are planned; B one shared standalone layout instead of one per
  remote, fold `core/constants` into `app/` and `api/`; C trim `pnpm check` to the safety rules,
  drop `move-component`; D merge the 29 docs into about 8; E remove Spec Kit if unused; F keep one
  starter shell layout.
- **Remote-to-remote sharing at runtime** (one remote rendering another's component): deferred;
  today shared code goes to `apps/<zone>/libs` or `packages/common`.
- **Not yet verified on a real server:** Docker/nginx images and the generated runtime manifest are
  only covered by static tests. Do a DevOps trial deployment.
- **To confirm with other teams:** official Singpass/Corppass button artwork (the landing pages use
  text buttons, no logos); whether silent SSO is enabled for the intranet (`--sign-in-mode
redirect` then lets staff straight in).
- Old merged branches (`feat/base-ui`, `feat/flat-app-folders`, `feat/sign-in-landing`, …) can be
  deleted.
