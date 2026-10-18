# Toolchain

Pinned versions and known gotchas. Checked against the npm registry on 2026-10-17 (phase A0).
The exact versions live in the default catalog in `pnpm-workspace.yaml`. This file explains why
those versions were chosen.

## Pinned versions

| Tool                                            | Version                          | Where pinned                  | Notes                                                     |
| ----------------------------------------------- | -------------------------------- | ----------------------------- | --------------------------------------------------------- |
| Node.js                                         | 24 LTS (tested 24.21.0)          | `.nvmrc`, `engines.node >=24` | Corepack ships with Node 24                               |
| pnpm                                            | 12.14.0                          | `packageManager` (Corepack)   | `corepack enable` once, or run `corepack pnpm`            |
| react / react-dom                               | 19.3.1                           | catalog (tier 1)              | MF singleton                                              |
| react-router                                    | 8.4.0                            | catalog (tier 1)              | MF singleton. Package is ESM-only                         |
| @types/react / @types/react-dom                 | 19.3.0                           | catalog (tier 1)              |                                                           |
| @rspack/core / @rspack/cli                      | 2.2.9                            | catalog                       |                                                           |
| @rspack/dev-server                              | 2.2.1                            | catalog                       |                                                           |
| @module-federation/enhanced                     | 2.9.2                            | catalog                       | runtime API via `@module-federation/enhanced/runtime`     |
| nx                                              | 23.3.0                           | catalog                       | package-based mode                                        |
| typescript                                      | **6.0.3**                        | catalog                       | NOT 7.x, see below                                        |
| eslint                                          | 10.12.0                          | catalog                       | 10.13.0 was less than 1 day old, see minimumReleaseAge    |
| typescript-eslint                               | 8.71.2                           | catalog                       |                                                           |
| @eslint/js                                      | 10.0.1                           | catalog                       |                                                           |
| eslint-plugin-react-hooks                       | 7.1.1                            | catalog                       |                                                           |
| eslint-plugin-prettier / eslint-config-prettier | 5.5.7 / 10.1.8                   | catalog                       |                                                           |
| prettier                                        | 3.9.10                           | catalog                       |                                                           |
| globals                                         | 17.13.0                          | catalog                       |                                                           |
| @types/node                                     | 24.19.2                          | catalog                       | matches the Node major                                    |
| jest / jest-environment-jsdom                   | 30.5.2                           | catalog (A2)                  | via `@org/jest-config`                                    |
| @swc/jest / @swc/core                           | 0.2.39 / 1.16.18                 | catalog (A2)                  | ts-jest not used                                          |
| @testing-library/react / user-event / jest-dom  | 16.3.3 / 14.6.8 / 7.0.1          | catalog (A2)                  | + @testing-library/dom 10.4.2, @types/jest 30.0.0         |
| sass / sass-loader / css-loader / style-loader  | 1.105.1 / 17.0.1 / 7.1.5 / 4.0.0 | catalog (A2)                  | used by `@org/rspack-config`                              |
| workbox-build                                   | 7.4.1                            | catalog (A2)                  | used by `@org/pwa/build`                                  |
| ajv                                             | 8.20.0                           | catalog (A3)                  | dev only: generates the manifest validator                |
| @nx/eslint-plugin                               | 23.3.0                           | catalog (A5)                  | `enforce-module-boundaries`, same version as nx           |
| yaml                                            | 2.9.1                            | catalog (A5)                  | `tools/scripts` reads `pnpm-workspace.yaml`               |
| @playwright/test                                | 1.64.1                           | catalog (A8)                  | Chromium revision 1248; shells + `@org/playwright-config` |
| @axe-core/playwright                            | 4.14.0                           | catalog (A8)                  | brings axe-core 4.14                                      |

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

## Gotchas found in A6 (auth)

- **Dev-only code out of production bundles.** `loadAuthClient` does
  `if (process.env.NODE_ENV !== 'production') { await import('./mock') }`. Rspack defines
  `process.env.NODE_ENV` from the mode (`optimization.nodeEnv`), folds the condition and drops the
  dynamic import, so no chunk is emitted. Checked: the production shell, both remotes: 0 files
  contain the mock marker; a `--mode development` build of the same shell emits
  `packages_auth_src_mock_ts.js`. This also works inside a shared (MF singleton) package, because
  the shell's build compiles the copy that is used.
- **`@org/auth` is a tier-1 singleton.** In production the share scope showed `@org/auth@0.1.0`
  `from: internet_shell`, `useIn: [internet_shell, internet_my_profile]`, and the remote's
  `useAuth()` read the shell's provider (`signedIn`). Every generated app depends on `@org/auth`
  (otherwise `createSharedConfig` warns that a tier-1 package is not shared).
- **Ajv `strict` + `if/then/else`:** a `required` inside `else` must also list the properties in
  that subschema (`strictRequired`), even if they are defined at the top level:
  `"else": { "properties": { "sessionUrl": {} }, "required": ["sessionUrl"] }`. The `if` keyword
  adds a generic 'must match "else" schema' error; `validateMfeManifest` drops it and keeps the
  specific `required` messages.
- **Secure cookies on `http://localhost`**: Chromium accepts `Secure` cookies from
  `http://localhost`, and `localhost:3200` → `localhost:4000` is same-site, so a fake BFF on another
  port exercises the real `HttpOnly; Secure; SameSite=Lax` + credentialed CORS setup. Production
  domains need the same-site check described in docs/auth-contract.md (`gov.sg` is a public
  suffix).
- `zsh` expands `--include=*.js` in `grep -r` before grep sees it ("no matches found"); quote it
  (`--include='*.js'`).

## Gotchas found in A7 (external modules)

- **Native `import()` of a runtime URL**: `import(/* webpackIgnore: true */ url)` is left alone by
  Rspack 2 (the production adapter fetched `http://localhost:4100/mount.js` from the manifest). In
  Jest (SWC → CommonJS) `import()` becomes `require()`, so tests inject a loader.
- **SRI for ES modules**: `import()` has no `integrity` option. `<link rel="modulepreload"
integrity crossorigin>` first, then `import()` of the same URL reuses the verified module map
  entry. With a wrong hash Chromium logs "Failed to find a valid digest in the 'integrity'
  attribute … The resource has been blocked" and the preload's `error` event fires
  (`load-failed`).
- **Failed module URLs may stay failed**: a dynamic import that failed (vendor down) can be cached
  as failed for that URL, so "Try again" adds `?mfeRetry=<n>`. Verified: vendor down → fallback,
  vendor back → "Try again" loaded `/mount.js?mfeRetry=1`.
- **StrictMode**: effects run mount → cleanup → mount. Because loading is async and the first run
  is cancelled before `mount()`, the vendor is mounted once (vendor console log shows one
  `mount`).
- **Contract `.d.ts` without a build**: `ts.transpileDeclaration` (TS ≥ 5.5, needs code that
  satisfies `isolatedDeclarations`) turns `contract.ts` into `mount-contract.d.ts`;
  `ts.transpileModule` turns `contract.ts`/`load.ts` into browser ES modules for the test host
  (relative imports get `.js` appended; `import type` is erased).
- **CSP via `<meta>` added by script** is enforced by Chromium (the test host blocked a `fetch` to a
  non-allowed origin), but `frame-ancestors` is ignored in a meta tag (console error); it belongs
  in the HTTP header.
- **Zip without dependencies**: `zlib.deflateRawSync` + `zlib.crc32` (Node ≥ 22.2). External
  attributes `0o100644 << 16` overflow a signed 32-bit int: write `(… << 16) >>> 0`. `unzip -t`
  reports no errors.
- **Nx continuous task dependencies across projects**: the adapter's
  `nx.targets.dev.dependsOn: [{ projects: ['@org/mock-vendor'], target: 'dev' }]` makes
  `pnpm dev:internet` start the mock vendor although it has no `zone:` tag.
- Playwright locators (`getByTestId`, `getByRole`) pierce **open** shadow roots, so vendor UI in a
  shadow root can be tested without special selectors.

## Gotchas found in A8 (testing)

- **Standalone deep links were broken.** A remote has `output.publicPath: 'auto'`, so
  HtmlRspackPlugin wrote `<script src="main.js">` (relative). Reloading
  `http://localhost:3101/details` requested `/details/main.js`, got `index.html` from the history
  fallback and failed with "Unexpected token '<'". `@org/rspack-config` now sets the HTML plugin's
  `publicPath: '/'` (option `htmlPublicPath`); federation chunks still use `auto`. Found by the
  generated `standalone.spec.ts`.
- **Playwright config as ESM TypeScript** (`playwright.config.ts` in a `"type": "module"` app)
  works with `import.meta.dirname`; so do the specs.
- **Several dev servers from one `webServer`:** Playwright waits for one URL only. The shell
  URL is the `webServer.url`; a global setup polls every remote's `mf-manifest.json` (and the mock
  vendor) before the first test. On shutdown Nx prints "Tasks not run because their dependencies
  failed" for the continuous tasks it stopped: noise. No server was left listening afterwards
  (checked with `lsof` after every run).
- `test.fail()` negative controls confirmed that `checkA11y` reports a low-contrast element and
  the console fixture fails a test that calls `console.error`.
- `@axe-core/playwright` types come from `axe-core`, which is not a direct dependency in the
  isolated layout; `@org/playwright-config` derives the result types from `AxeBuilder['analyze']`.

## Gotchas found in A9 (deploy, list-apps)

- **`pnpm -s <script>` still echoes the command line, on stderr.** Stdout carries only the
  script's output, so `pnpm -s apps --json | jq` and `$(pnpm -s apps --matrix)` work; do not
  merge stderr into the JSON.
- `nx show projects --affected --base=<sha>` without `--head` includes uncommitted and untracked
  files (it compares with the working tree). `list-apps` runs it with `NX_DAEMON=false` so CI
  does not leave a daemon behind. Nx knows nothing about `deploy/`, so list-apps adds its own
  rule: a change in `deploy/` (or root config / the lockfile) affects every app.
- **Nx 23 keeps its task cache outside the repo** (`~/.nx/<workspace hash>/cache`; `.nx/` in the
  repo only holds `workspace-data`). Two copies of the repo can share cache hits. CI sets
  `NX_CACHE_DIRECTORY` to a path it can cache (verified: the override is honoured).
- **No Docker or nginx on the authoring machine.** The Dockerfile build stage was run as plain
  commands in a copy of a generated workspace (`pnpm fetch`, `pnpm install --frozen-lockfile
--offline --filter "<app>..."`, `pnpm --filter <app> run build`): only the app's dependency
  closure is installed and the build works for a shell and a remote. The nginx config itself is
  unverified (`nginx -t` not run); `tools/scripts/test/deploy.test.js` checks it statically.
- **The CSP template was tested in a browser** with a small Node server sending the rendered
  security headers in front of production builds (shell :4100, remotes :4101–4103, mock vendor
  :3999): zero violations; with the remote origins removed, Chromium blocked the
  `mf-manifest.json` fetch and the shell showed `RemoteFallback`. `upgrade-insecure-requests`
  was left out for that `http://localhost` test. `style-src 'unsafe-inline'` is required
  (style-loader); `'unsafe-eval'` is not.
- nginx `add_header` is not inherited into a `location` that has its own `add_header`: every
  location in the template includes the security headers file again (checked by a test).
- The official nginx image's envsubst step only replaces variables that exist in the
  environment; an unset `${CSP_…}` would stay in the config literally. The Dockerfile gives every
  template variable a default.

## Gotchas found in the template follow-ups (C1)

- **`source-map` copies dev-only code into production `.map` files.** The minifier drops
  `if (process.env.NODE_ENV !== 'production') { … }` branches from the bundles, but
  `sourcesContent` holds the original source (mock vendor / mock API `http://localhost:…` URLs).
  `@org/rspack-config` now builds `hidden-nosources-source-map` (mappings + file names, no
  sources, no `sourceMappingURL` comment) and turns off css-loader/sass-loader maps in
  production (they were inlined as base64 into the JS bundles).
- **jsdom has no Fetch API** (`fetch`, `Headers`, `Request`, `Response` undefined), so
  `@org/http-client` threw `Headers is not defined` in component tests. `@org/jest-config` now
  uses its own jsdom environment that copies Node's `Headers`/`Request`/`Response` in (not
  `fetch`: tests inject `createFakeFetch` from `@org/jest-config/fetch`). Response objects come
  from Node's realm, so `toEqual` works but `instanceof Object` on parsed JSON does not.
- **Chromium logs failed subresources without their URL.** A 4xx/5xx `fetch` shows up as
  console error "Failed to load resource: the server responded with a status of 422" whose
  `location().url` is not the request URL, so `allowedConsoleErrors` could not be scoped to one
  endpoint. The `@org/playwright-config` fixture now skips that line and records failed
  requests from `page.on('response')` (status ≥ 400) and `page.on('requestfailed')` (except
  `net::ERR_ABORTED`) with method + URL; `allowedHttpErrors` / `consoleErrors.allowHttp()`
  match on those.
- **One shared mock vendor port broke running two zones at once** (`pnpm dev:intranet` and
  `pnpm dev:internet` both started `@org/mock-vendor` on 3999). Each zone now reserves the top
  ten ports of its range for dev tools (intranet 3190–3199, internet 3290–3299; apps end at
  3189 / 3289); tools take Nx targets `serve:<zone>` and read their port from
  `toolPort(zone, tool)` in `tools/scripts/src/zones.js`. Which tool has which offset in that
  range is declared in the root `package.json` (`mfe.tools`), so adding a tool server needs no
  change to shared code (docs/architecture.md, "Adding a dev-tool server").
- **Packages cannot import tools** (`@nx/enforce-module-boundaries`: `type:package` → only
  `type:package`). `@org/playwright-config` therefore reads the same root `package.json`
  `mfe.tools` itself (`TOOL_PORTS`) and mirrors only the zones' tools ranges
  (`ZONE_TOOL_RANGES`); a `tools/scripts` test compares both with `zones.js`.
- **Stopping `nx run-many` looks like a failure.** When Playwright stops the webServer (or you
  press Ctrl-C), Nx kills its continuous tasks and prints "Tasks not run because their
  dependencies failed or --nx-bail=true" plus "Tasks stopped before they finished"; no Nx flag
  turns this off. `pnpm dev:<zone>` therefore runs `tools/scripts/bin/dev.js`, which passes the
  signal on, drops the output after it and exits 0 with one "dev servers stopped" line. Nx
  starts every task in its own process group, so the servers stop because Nx forwards the
  signal, also when only the launcher is signalled.
- **Nx continuous dependencies are deduplicated**: the shell and every remote of a zone declare
  `dev.dependsOn: [{ projects: ['@org/mock-api'], target: 'serve:<zone>' }]`; `nx run-many -t dev`
  starts the mock API once.
