# Toolchain

Pinned versions and known gotchas. Checked against the npm registry on 2026-10-17 (phase A0).
The exact versions live in the default catalog in `pnpm-workspace.yaml`. This file explains why
those versions were chosen.

## Pinned versions

| Tool                                            | Version                          | Where pinned                  | Notes                                                  |
| ----------------------------------------------- | -------------------------------- | ----------------------------- | ------------------------------------------------------ |
| Node.js                                         | 24 LTS (tested 24.21.0)          | `.nvmrc`, `engines.node >=24` | Corepack ships with Node 24                            |
| pnpm                                            | 12.14.0                          | `packageManager` (Corepack)   | `corepack enable` once, or run `corepack pnpm`         |
| react / react-dom                               | 19.3.1                           | catalog (tier 1)              | MF singleton                                           |
| react-router                                    | 8.4.0                            | catalog (tier 1)              | MF singleton. Package is ESM-only                      |
| @types/react / @types/react-dom                 | 19.3.0                           | catalog (tier 1)              |                                                        |
| @rspack/core / @rspack/cli                      | 2.2.9                            | catalog                       |                                                        |
| @rspack/dev-server                              | 2.2.1                            | catalog                       |                                                        |
| @module-federation/enhanced                     | 2.9.2                            | catalog                       | runtime API via `@module-federation/enhanced/runtime`  |
| nx                                              | 23.3.0                           | catalog                       | package-based mode                                     |
| typescript                                      | **6.0.3**                        | catalog                       | NOT 7.x, see below                                     |
| eslint                                          | 10.12.0                          | catalog                       | 10.13.0 was less than 1 day old, see minimumReleaseAge |
| typescript-eslint                               | 8.71.2                           | catalog                       |                                                        |
| @eslint/js                                      | 10.0.1                           | catalog                       |                                                        |
| eslint-plugin-react-hooks                       | 7.1.1                            | catalog                       |                                                        |
| eslint-plugin-prettier / eslint-config-prettier | 5.5.7 / 10.1.8                   | catalog                       |                                                        |
| prettier                                        | 3.9.10                           | catalog                       |                                                        |
| globals                                         | 17.13.0                          | catalog                       |                                                        |
| @types/node                                     | 24.19.2                          | catalog                       | matches the Node major                                 |
| jest / jest-environment-jsdom                   | 30.5.2                           | catalog (A2)                  | via `@org/jest-config`                                 |
| @swc/jest / @swc/core                           | 0.2.39 / 1.16.18                 | catalog (A2)                  | ts-jest not used                                       |
| @testing-library/react / user-event / jest-dom  | 16.3.3 / 14.6.8 / 7.0.1          | catalog (A2)                  | + @testing-library/dom 10.4.2, @types/jest 30.0.0      |
| sass / sass-loader / css-loader / style-loader  | 1.105.1 / 17.0.1 / 7.1.5 / 4.0.0 | catalog (A2)                  | used by `@org/rspack-config`                           |
| workbox-build                                   | 7.4.1                            | catalog (A2)                  | used by `@org/pwa/build`                               |
| ajv                                             | 8.20.0                           | catalog (A3)                  | dev only: generates the manifest validator             |
| @nx/eslint-plugin                               | 23.3.0                           | catalog (A5)                  | `enforce-module-boundaries`, same version as nx        |
| yaml                                            | 2.9.1                            | catalog (A5)                  | `tools/scripts` reads `pnpm-workspace.yaml`            |
| Playwright (planned, A8)                        | 1.64.1                           | added in A8                   |                                                        |

## A0 spike: one React instance across shell and remote

The throwaway spike ran in a scratch directory outside the repo:

- a pnpm 12 workspace with `nodeLinker: isolated` and a catalog
- `spike_shell` on :3200 and `spike_remote` on :3201
- Rspack 2.2.9 + `@module-federation/enhanced/rspack`, running `rspack dev` for both
- `react`, `react-dom` and `react-router` shared as `singleton: true, strictVersion: true, requiredVersion: <catalog version>`

How it works:

- The shell sets `output.publicPath: '/'` and `remotes: {}`.
- At startup the shell fetches `/mfe-manifest.json` (`{ remotes: { spike_remote: { entry: "http://localhost:3201/mf-manifest.json" } } }`).
- It then calls `registerRemotes([...])` and `loadRemote('spike_remote/App')` from `@module-federation/enhanced/runtime`, rendered through `React.lazy` + `Suspense`.
- The remote's component uses `useState`, `useContext` on a context object created by the shell, and `useLocation()` inside the shell's `<BrowserRouter>`.

Headless Chromium (Playwright 1.64.1) opened `http://localhost:3200/some/deep/path` and returned:

```
sameReact: true          // window.__shellReact === window.__remoteReact (same module object)
sameRouter: true         // react-router UNSAFE_LocationContext identical in shell and remote
path: "/some/deep/path"  // remote's useLocation() reads the shell's router
greeting: "Remote says: hello from shell context"   // useContext across the boundary
button: "clicks 2"       // useState works after 2 clicks (no "Invalid hook call")
__FEDERATION__.__INSTANCES__: [spike_shell, spike_remote]
share scope: react@19.3.1, react-dom@19.3.1 and react-router@8.4.0 all show from=spike_shell, useIn=[spike_shell, spike_remote]
page errors / console errors: []
```

Network requests to the remote origin were only `mf-manifest.json`, `remoteEntry.js` and
`__federation_expose_App.js`. The remote's own React vendor chunks were never downloaded.
Opened on its own (`http://localhost:3201/`), the remote also rendered in standalone mode.

Negative control (found by accident): a shell build that did not list `react-router` in `shared`
crashed the remote with `useLocation() may be used only in the context of a <Router>`. The two
copies of react-router had separate contexts. So every library holding React context must be a
tier-1 singleton.

## Gotchas

### TypeScript 7 is not usable yet

- `typescript-eslint@8.71.2` has the peer range `typescript >=4.8.4 <6.1.0`.
- `ts-jest@29.4.15` has the peer range `typescript >=4.3 <7`.
- So TypeScript is pinned to 6.0.3. Re-check when typescript-eslint supports 7.
- `@module-federation/enhanced` accepts `^7` and pulls TS 7 in as an auto-installed peer when no
  `typescript` is declared. Packages that typecheck should declare `typescript: catalog:` themselves.

### pnpm 12

- **Install scripts are blocked by default and the install fails** (`ERR_PNPM_IGNORED_BUILDS`).
  `onlyBuiltDependencies` is ignored. Use the `allowBuilds:` map in `pnpm-workspace.yaml`. `nx`
  needs it for its postinstall. `@swc/core` worked without it because its binaries come as
  optional dependencies, so it is not allow-listed.
- **`catalogMode` semantics changed.** In pnpm 12.14:
  - `manual`: `pnpm add react` writes `catalog:` when the package is in the catalog. A package
    that is not in the catalog (e.g. `pnpm add zod`) gets a normal `^x.y.z` range in that app's
    package.json.
  - `prefer`: also writes `catalog:`, but **adds every new package to the default catalog**,
    explicit version or not. `pnpm remove` does not take the entry back out.
  - `strict`: rejects versions outside the catalog.

  The plan called for `prefer` meaning "use the catalog when available, allow app-local
  installs". In pnpm 12 that behavior is `manual`, so the template uses `catalogMode: manual`.
  With `prefer`, every tier-3 dependency would silently become tier 2.

- **`minimumReleaseAge` is on by default.** Packages published less than about a day ago are held
  back. On install, pnpm writes a `minimumReleaseAgeExclude` entry into `pnpm-workspace.yaml` for
  them (it did this for eslint 10.13.0). Pin versions that are a few days old instead, and delete
  any exclude entries pnpm adds.
- The isolated linker keeps the virtual store at `node_modules/.pnpm` in the root. The root
  `node_modules` holds only the root package's own deps (nx, prettier, @org/prettier-config).
  Every package has its own `node_modules` with only its declared deps (D7).
  `hoistPattern: []` and `publicHoistPattern: []` turn off the remaining hoisting.
- Missing peer dependencies are auto-installed. For example `@org/prettier-config` gets
  `prettier` in its `node_modules`.
- A `packageManager` field in a parent directory (e.g. `~/package.json`) makes the Corepack shim
  refuse to run outside this repo. Inside the repo, our own `packageManager` wins.

### Module Federation / Rspack

- Use the runtime API `registerRemotes` / `loadRemote` from `@module-federation/enhanced/runtime`.
  Combined with the plugin's `shared` config, this gives one React instance (verified above).
- Shell: `output.publicPath: '/'`, so deep links like `/some/deep/path` load chunks from root.
  Remote: `publicPath: 'auto'`, so chunks resolve against the remote's own origin.
- `HtmlRspackPlugin({ chunks: ['main'] })` and `lazyCompilation: false` were used in the spike, as
  an earlier spike recommended (without them the standalone remote reportedly renders blank).
  They were not separately disproved here. Keep them.
- The remote dev server needs `Access-Control-Allow-Origin: *`.
- `rspack dev` does not reload the config file when it changes. Restart the dev server after
  editing `rspack.config.*` or the shared config. A stale server showed exactly the two-router
  failure above.
- The bootstrap pattern (`index.js` → `import('./bootstrap')`) is still required so shared
  singletons are negotiated before React is imported.

### Jest (for A8)

- Jest 30 + jsdom works with both `ts-jest` (TS 6) and `@swc/jest`.
- `react-router` 8 is ESM-only and pulls in more ESM-only packages (`@remix-run/*`,
  `cookie-es` as `.mjs`). Native require(esm) in Jest 30 did not pick them up. The fix that worked:
  - `transformIgnorePatterns: ['/node_modules/(?!(\\.pnpm/[^/]+/node_modules/)?(react-router|@remix-run|cookie-es)/)']`
    (the pattern has to allow pnpm's `.pnpm/<pkg>@<ver>/node_modules/` paths)
  - transform `.js`/`.mjs` with `@swc/jest` and `module.type: 'commonjs'`
  - `jsc.transform.optimizer.globals.vars: { 'import.meta.hot': 'undefined' }`, because
    react-router reads `import.meta.hot`
  - a setup file that adds `TextEncoder` / `TextDecoder` from `node:util` to jsdom

## Gotchas found in A2/A3

### pnpm

- New packages with install scripts fail the install again (`ERR_PNPM_IGNORED_BUILDS`):
  `@swc/core`, `unrs-resolver` (from jest) and `@parcel/watcher` (from sass). All three ship
  prebuilt binaries as optional dependencies, so they are listed as `false` in `allowBuilds`
  (explicitly denied, which silences the error).
- **Stray `@types/react` from outside the repo.** `react-router`'s `.d.ts` files import `react`,
  but react-router does not declare `@types/react`. In the isolated layout TypeScript cannot find
  it next to react-router and walks up the directory tree, past the repo root. On a machine with
  `~/node_modules/@types/react` (v18 here) every react-router component failed with "cannot be
  used as a JSX component". Fix: `packageExtensions` in `pnpm-workspace.yaml` gives react-router an
  optional `@types/react` peer, so pnpm links the catalog version next to it.
  Side effect: react-router gets one store entry per peer set. Give every package that depends on
  react-router `@types/react` too (all TS packages/apps do), otherwise two copies exist on disk.
  At runtime MF still shares one, but keep it clean.
- Sass 1.105.2 was less than a day old (minimumReleaseAge). Pinned 1.105.1.

### Rspack / Module Federation

- `@rspack/core` 2 is **ESM-only**. Config code that imports it must be ESM. `@org/rspack-config`
  is ESM and tested with `node --test`, not Jest (Jest cannot `require()` it, see below).
- The Rspack CLI sets `NODE_ENV` (`build` → production, `dev`/`serve` → development) before it
  loads the config and passes `env.RSPACK_SERVE` / `env.RSPACK_BUILD` to config functions. The
  factories return `(env, argv) => config` and derive the mode from these.
- Loaders (`style-loader`, `css-loader`, `sass-loader`) are passed as absolute paths
  (`require.resolve`) from `@org/rspack-config`. Apps do not need them installed (D7).
- Rule `type: 'javascript/auto'` is set on the SCSS/CSS rules, so Rspack's native CSS handling
  does not process them a second time.
- `css-loader` `modules.localIdentHashSalt = <federation name>` gives each app different hashes
  for the same file + class (checked by a real build in the rspack-config tests).
- sass-loader compresses CSS in production mode (`padding:4px`, not `padding: 4px`).
- MF `dts: false`: the DTS plugin would otherwise try to generate/consume remote types (slow,
  needs a TS server). Remote types come from the contract instead.

### Jest

- `@org/jest-config` resolves every tool path (`jest-environment-jsdom`, `@swc/jest`,
  `identity-obj-proxy`, the setup file) from itself, so packages only need `jest` + types.
- Jest 30 under Node 24 still fails with "Must use import to load ES Module" for ESM-only
  packages that are not transformed (e.g. `@rspack/core`). Do not unit-test Rspack config code with
  Jest; use `node --test`.
- `new Response('', { status: 204 })` throws in Node 24. Use a `null` body.

### Found during the A3 browser verification

- Apps do not need `@module-federation/enhanced` as their own dependency. `@org/rspack-config`
  brings the plugin and its runtime, and `@org/mf-runtime` imports
  `@module-federation/enhanced/runtime`. Both re-export the single `@module-federation/runtime`
  store entry, so `registerRemotes`/`loadRemote` act on the instance the plugin created
  (`__FEDERATION__.__INSTANCES__` = `[shell, remote]`).
- **Do not check "one React" with `import * as React` identity in production builds.** In dev
  `window.__shellReact === window.__remoteReact` was true. In prod it was false, because each build
  wraps the shared CJS module in its own ESM namespace object. `React.useState` and React's
  internals object were identical, so there was still one React. Compare a function or the
  internals, not the namespace object.
- A `lazy()` component created _below_ the Suspense boundary is re-created when the boundary
  retries, because a component that suspends before its first commit loses its hook state. So it
  loads twice and retry counting breaks. `<RemoteApp>` creates the lazy component above Suspense.
- After a failed load, MF keeps the failed remote. Retry calls `registerRemotes([remote], { force:
true })` before loading again. Verified in the browser: the remote's `mf-manifest.json` was
  blocked (2 attempts), then unblocked, and "Try again" rendered the remote.
- `registerPwa()` in dev made the browser fetch `/service-worker.js`. The dev server's history
  fallback answers with `index.html` ("unsupported MIME type" console error). `registerPwa` now runs
  only in production builds by default (`enabled` option).
- Do not create file names that differ only by case (`remoteApp.tsx` vs `RemoteApp.tsx`). The
  default macOS file system is case-insensitive.
- The remote fetches only `mf-manifest.json`, `remoteEntry.js`, its expose chunks and the small
  css-loader/style-loader runtime chunk. It does not fetch React or react-router chunks.

## Gotchas found in A4/A5

### pnpm

- **`pnpm <script>` installs first when manifests changed** (pnpm 12 checks the lockfile before
  running a script). After `pnpm gen:remote` the next `pnpm ...` command links the new app on its
  own; after editing a `package.json`, `pnpm check` may update `pnpm-lock.yaml` before it runs.
  `node tools/scripts/bin/check.js` runs the checks without that step. CI runs
  `pnpm install --frozen-lockfile` first, so an unexpected lockfile change fails there.
- `pnpm --filter <app> add zod` when the app already has `"zod": "^4.6.7"` keeps that range even
  after `zod` was added to the catalog. `pnpm --filter <app> add zod@catalog:` rewrites it to
  `catalog:` (also for tier-1 packages). The check messages and docs use the `@catalog:` form.
- `pnpm gen:remote intranet x --private` passes `--private` through to the script (no `--`
  needed).
- `@nx/eslint-plugin` `require`s `typescript` without declaring it. In the isolated layout the
  rule crashed with "Cannot find module 'typescript'". Fixed with a `packageExtensions` peer
  (`pnpm-workspace.yaml`).

### Nx

- **`enforce-module-boundaries` does not see imports of apps by package name.** Nx maps an
  import to a workspace project only when that package declares `exports` or `main`; generated
  apps declare neither, so `import '@org/internet-services'` was not flagged even with the
  dependency in `package.json`. Relative imports into another project are flagged. The shared
  ESLint config therefore also bans `@org/intranet-*`, `@org/internet-*`, `@org/shell-*` with
  `no-restricted-imports`, and `check-apps` scans app sources (incl. `import()` / `require()`)
  and `package.json` dependencies as a backstop.
- When the rule reports a violation it also logs `Error reading "tsconfig.base.json"` (it tries to
  build a fix suggestion). Noise; there is deliberately no `tsconfig.base.json` (with one, `nx`
  itself needs `typescript` resolvable from its own folder and crashed).
- Tags come from `package.json` `nx.tags`; `nx run-many -t dev --projects=tag:zone:intranet`
  selects a zone. `dev` is a `continuous` target in `nx.json`; `--parallel=100` lets every dev
  server of the zone start.
- Nx 23 prints only a summary for failed tasks; add `--output-style=static` to see the logs.

### Generated apps

- `rspack.config.js` reads `mfe.port` / `mfe.federationName` from `package.json`, so the port
  allocated by the generator and checked by `check-apps` is the one the dev server uses.
- `rspack preview` is not used: `pnpm preview` runs `mfe-preview` (`@org/scripts`), a small static
  server with CORS and SPA fallback on the app's port. A shell needs a `mfe-manifest.json`
  (`--manifest <file>` or a copy in `dist/`), as in production.
- Shell `bootstrap.tsx` catches a failing `/mfe-manifest.json` and renders `StartupError`
  (connection-required message when offline) instead of a blank page.
- Remote templates test that the exposed module's import graph never reaches
  `@org/design-tokens/global.scss` or `registerPwa`.
- Template placeholders are `__TOKEN__`; a token directly followed by `_` (`__ZONE___alpha`) needs
  the non-greedy token pattern in `render.js`.
- Prettier 3 `getFileInfo` resolves config files by default. In a temp workspace without
  `@org/prettier-config` installed it threw; the generators pass `resolveConfig: false` and the
  options from `@org/prettier-config` directly.

### Jest

- `@org/jest-config` sets `maxWorkers: '50%'`: Nx runs several Jest processes in parallel and each
  would otherwise start (cores − 1) workers. `testTimeout` is 15 s: under a load average of 40-80
  one A3 `mf-runtime` run failed once (passed on re-run).
