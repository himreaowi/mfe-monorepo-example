# Testing

| Layer                 | Tool                                                         | Where                                                                  | Run                                                |
| --------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------- | -------------------------------------------------- |
| Unit / component      | Jest 30 + React Testing Library (jsdom)                      | `src/**/*.test.ts(x)` in every app and React package                   | `pnpm test` (all), `pnpm --filter <pkg> test`      |
| Node / contract tests | `node --test`                                                | `tools/*`, `packages/rspack-config`, `vendor-kit`, `playwright-config` | part of `pnpm test`                                |
| End-to-end (per zone) | Playwright (Chromium), desktop + 375 px                      | `apps/<zone>/shell-<zone>/e2e/`                                        | `pnpm e2e`, `pnpm e2e:<zone>`                      |
| Accessibility         | axe-core (`@axe-core/playwright`), WCAG 2.2 AA, light + dark | `e2e/a11y.spec.ts` in each shell                                       | part of `pnpm e2e`                                 |
| Static checks         | `pnpm check`, ESLint, `tsc`, Prettier                        | everywhere                                                             | `pnpm lint`, `pnpm typecheck`, `pnpm format:check` |

## Unit tests (Jest + React Testing Library)

Every app and React package has `jest.config.js`:

```js
import { createJestConfig } from '@org/jest-config';

export default createJestConfig({ rootDir: import.meta.dirname });
```

`@org/jest-config` sets jsdom, the SWC transform (TS/TSX and the ESM-only `react-router`),
`identity-obj-proxy` for (S)CSS modules, the `@/` alias, `jest-dom` matchers, `matchMedia` and
`TextEncoder`. It caps `maxWorkers` at `50%` (Nx runs several Jest processes at once) and sets
`testTimeout` to 15 s; keep both. Tests live next to the code (`Foo.tsx` + `Foo.test.tsx`), only
under `src/` (Jest `roots`).

What the generated apps test, as examples to follow:

| App              | Tests                                                                                                                                                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell            | routes (home, `/<remote>/*` mounts `<RemoteApp>`, 404) with `@org/mf-runtime` mocked; `RemotePage` (private remote not rendered before sign-in, `user` host prop); nav; startup error; http client                    |
| Remote           | `EmbeddedApp` below a shell-like splat route (host props, links get the mount path) and `StandaloneApp` (mock host props, own chrome); the exposed module's import graph never reaches global styles or `registerPwa` |
| External adapter | `ExternalModuleHost` with a fake `load` (mount, update on theme/path change, unmount, `onNavigate` through the router, errors → fallback); `vendorConfig` dev fallback                                                |

Rules:

- Query like a user: `getByRole`, `getByLabelText`, `getByText`; `getByTestId` for structure
  only. Interact with `@testing-library/user-event`.
- No network in unit tests: inject `fetch` (`createHttpClient({ fetch })`,
  `createAuthClient(config, { fetch })`) or mock the module (see "Testing API code" below).
- Never load a real remote in Jest. Mock `@org/mf-runtime` (`RemoteApp`) in shell tests; render
  `EmbeddedApp` with props in remote tests.
- `new Response('', { status: 204 })` throws in Node 24: use a `null` body.

### Testing API code (jsdom has no `fetch`)

jsdom implements no Fetch API: in a plain `jest-environment-jsdom`, `fetch`, `Headers`,
`Request` and `Response` are all undefined. `@org/jest-config`'s jsdom environment adds Node's
`Headers`, `Request` and `Response` (so `@org/http-client` works in component tests) but leaves
**`fetch` undefined on purpose**: a test that forgets to inject one fails with
`fetch is not defined` instead of calling a real server.

Recommended split (the generated remote's `features/demo` does exactly this):

| Layer                     | How to test                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `features/*/api/` (pure)  | real `@org/http-client` + a fake fetch: `createFakeFetch` from `@org/jest-config/fetch`; assert URLs, bodies, parsed results, errors |
| `features/*/hooks/`, UI   | `jest.mock('../api')` (or pass a stubbed client): render states (loading, data, empty, error, retry) without HTTP                    |
| `services/http.ts`        | base URL resolution (`http.url(apiRoutes…)`), no request                                                                             |
| Real API / mock API flows | e2e (`tools/mock-api` runs with `pnpm dev:<zone>`)                                                                                   |

```ts
import { createFakeFetch } from '@org/jest-config/fetch';
import { HttpClientError, createHttpClient } from '@org/http-client';
import { createItem, listItems } from './itemsApi';

const fetch = createFakeFetch({
  'GET /api/items': { body: [{ id: 1, name: 'First' }] },
  'POST /api/items': { status: 422, body: { errors: { name: 'Required' } } },
});
const http = createHttpClient({ baseUrl: 'http://api.test/api', fetch });

it('lists items', async () => {
  await expect(listItems(http)).resolves.toEqual([{ id: 1, name: 'First' }]);
  expect(fetch.calls[0].url).toBe('http://api.test/api/items');
});

it('exposes 422 field errors', async () => {
  const error = await createItem(http, { name: '' }).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(HttpClientError);
  expect((error as HttpClientError).body).toEqual({
    errors: { name: 'Required' },
  });
});
```

`createFakeFetch(routes)`: keys `"<METHOD> <pathname>"`, values `{ status?, body? }`, a `Response`
or a function of the call (`{ url, method, pathname, query, body, init }`); unknown routes answer
404; `fetch.calls` records every request. `jsonResponse(body, { status })` builds a single
response (for `jest.fn().mockResolvedValue(...)`). A file that needs Node's real `fetch` (rare;
never against a shared server) can start with the docblock `/** @jest-environment node */`.

## Node and contract tests

Code that runs in Node (configs, CLIs, generators) is tested with `node --test`, not Jest
(`@rspack/core` is ESM-only, see [toolchain.md](toolchain.md)). These also hold the **contract
tests** that keep generated or shared artefacts honest:

| Package                      | Covers                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `tools/generators`           | generates both zones into a temp workspace, checks files, metadata, registry, dev manifest; `check-apps`/`check-versions` pass |
| `tools/scripts`              | every guardrail rule with fixture workspaces; `list-apps` (incl. `--affected`); the `deploy/` templates; `validate-manifest`   |
| `packages/rspack-config`     | config shape (singletons, publicPath, HTML entry), a real build (CSS module salting, absolute script URLs)                     |
| `packages/vendor-kit`        | `mount-contract.d.ts` is up to date with `mf-runtime`; the kit builds and zips                                                 |
| `packages/mf-runtime` (Jest) | the generated manifest validator is up to date with `mfe-manifest.schema.json`                                                 |
| `packages/playwright-config` | zone loading, config (projects, servers, CI), URL waiting, axe report formatting                                               |
| `packages/jest-config`       | the fake fetch helpers                                                                                                         |
| `tools/mock-vendor`          | the mock vendor implements the mount contract (esm, web-component, script)                                                     |
| `tools/mock-api`             | health, items (list/filter/create, 422), reset, CORS for localhost with credentials, per-zone ports                            |

## End-to-end tests (Playwright)

One suite per **zone**, in the zone's shell (`apps/<zone>/shell-<zone>/e2e/`), generated by
`pnpm gen:shell`. It tests the zone the way users see it: the shell with every remote loaded at
runtime from the dev manifest, plus each remote standalone.

```sh
pnpm e2e                    # every zone, one at a time
pnpm e2e:intranet           # one zone
pnpm e2e:internet --project=desktop --grep "WCAG"   # Playwright options pass through
pnpm --filter @org/shell-intranet e2e e2e/remotes.spec.ts   # one spec
pnpm --filter @org/shell-intranet exec playwright test --ui # debug UI
```

First time on a machine: `pnpm --filter @org/shell-intranet exec playwright install chromium`
(any shell; the browser is shared). Reports: `apps/<zone>/shell-<zone>/playwright-report/`
(`pnpm --filter <shell> exec playwright show-report`), traces of failed tests in `test-results/`.

How it runs (`@org/playwright-config`):

1. `webServer` runs `pnpm dev:<zone>` in the repo root: the shell, every remote of the zone, the
   zone's mock API and, for external adapters, the zone's mock vendor. Locally an already running
   `pnpm dev:<zone>` is reused (fast reruns while you work); CI always starts fresh servers.
2. Global setup waits until every remote in `mfe-manifest.dev.json`, local vendor bundles and
   the local API's `<settings.apiBaseUrl>/health` (the mock API) answer. More servers:
   `createZoneConfig({ shellDir, extraHealthUrls: [...] })`.
3. Every test runs in two projects: `desktop` (1280×720) and `mobile` (375×812).
4. Afterwards the dev servers are stopped. `pnpm e2e` runs the zones one after the other; the
   zones' port ranges (tools included) do not overlap, so `pnpm dev:intranet` and
   `pnpm dev:internet` can also run at the same time.

The specs read `remotes.json` and `mfe-manifest.dev.json` (`e2e/helpers.ts`), so a new remote is
tested as soon as `pnpm gen:remote` registered it:

| Spec                 | For               | Checks                                                                                                                                                                                                                                                                                                                                                              |
| -------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shell.spec.ts`      | the shell         | home lists every remote; the nav opens each one without a page reload; 404 page; theme choice persists across reloads and applies to remotes; offline banner; the header is one row at 375/800/1024/1280 px signed out and in (≤ 80 px, ≤ 64 px at 375; wide or collapsed, no horizontal scroll); at 375 px a working Menu disclosure (Escape, outside click, link) |
| `remotes.spec.ts`    | every remote      | renders from a deep link (`/<remote>/e2e/deep/link`) and after a reload; links inside the remote navigate client-side (counted after `settle()`, so late links are not missed)                                                                                                                                                                                      |
|                      | `access: private` | signed out: sign-in prompt and **no request to the remote** before sign-in; mock sign-in renders it; sign-out shows the prompt again                                                                                                                                                                                                                                |
|                      | `kind: external`  | **any vendor**: the mount container holds vendor content, no fallback, no console errors, unmounted when leaving. **Mock vendor only** (skips with the reason otherwise): vendor routing goes through the shell URL, the theme reaches the vendor (`update()`)                                                                                                      |
| `standalone.spec.ts` | every remote      | its own dev server renders it standalone (own chrome and theme), deep link                                                                                                                                                                                                                                                                                          |
| `a11y.spec.ts`       | every page above  | axe WCAG 2.2 A + AA in the **light and the dark theme**; private remotes both signed out (prompt) and signed in                                                                                                                                                                                                                                                     |

Every test also **fails on a `console.error`, an uncaught exception or a failed HTTP request**
(fixture in `@org/playwright-config/test`). Failed requests (status ≥ 400, or a network error
other than an abort) are recorded from Playwright's `response` / `requestfailed` events **with
their URL**; Chromium's own URL-less "Failed to load resource" console line is skipped. Allow
expected failures as narrowly as possible, with a comment saying why:

```ts
// per file / describe
test.use({
  allowedConsoleErrors: [/ResizeObserver loop/],
  allowedHttpErrors: [{ url: /\/api\/items$/, status: 422, method: 'POST' }],
});

// per test
test('shows server validation errors', async ({ page, consoleErrors }) => {
  consoleErrors.allowHttp({ url: '/api/items', status: 422 });
  consoleErrors.allow(/expected warning text/);
  // …
});
```

`allowedHttpErrors` entries: `{ url?: RegExp | substring, status?: number | 'failed' | list,
method? }`, or a RegExp tested against `"<status> <METHOD> <url>"`. `consoleErrors.messages` and
`consoleErrors.httpFailures` hold what was seen so far.

### Writing more e2e tests

- Feature flows of one remote go into a new spec in the shell's `e2e/` (e.g.
  `e2e/leave-requests.spec.ts`), using `openRemote(page, remote)` from `helpers.ts` so private
  remotes sign in first. Find the remote with `zone.remotes.find((r) => r.name === 'leave-requests')`.
- `settle(page)` before asserting on data-driven content, counting links or running
  `checkA11y`: it waits for network idle and for loading indicators (`role="status"` starting
  with "Loading", `aria-busy="true"`) to disappear.
- Header controls (nav, theme toggle, user menu) are behind the "Menu" button whenever the
  header is compact (always at 375 px, on desktop too with many remotes): use `openNav(page)`
  (returns the "Apps" list) or `openHeaderMenu(page)` (returns the panel); both are no-ops when
  the header is wide. The panel closes after each navigation.
- The mock API (`tools/mock-api`) keeps state in memory: tests that create data call
  `POST <api origin>/__reset` first (`await page.request.post('http://localhost:3190/__reset')`),
  or use unique names.
- Import `test`/`expect` from `@org/playwright-config/test` (not `@playwright/test`) to keep the
  console-error check.
- Prefer roles and labels; `data-testid` for structure. Vendor widgets in an open shadow root
  are reachable with normal locators.
- Data: the suite runs against dev servers and mocks (mock sign-in, mock API, mock vendor). Use
  `page.route()` to stub error cases; do not depend on shared test environments.
- A real BFF or vendor in `mfe-manifest.dev.json` turns the mock-specific checks into skips
  (`zone.authMock`, `remote.mockVendor`), not failures.

## Accessibility

Target: **WCAG 2.2 AA** ([contracts/a11y-wcag.md](contracts/a11y-wcag.md)).

- Automated: `a11y.spec.ts` runs axe (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22a`,
  `wcag22aa`) on the home page, the 404 page, every remote in the shell, every private remote's
  sign-in prompt and every remote standalone, each in light and dark, on desktop and 375 px.
  `checkA11y(page)` fails with one line per failing element (rule, impact, selector, fix).
- Use `checkA11y(page, { include: ['[data-testid="my-dialog"]'] })` after opening dialogs or
  menus in feature tests: axe only sees what is rendered.
- Do not disable rules to get green. If a rule must be skipped (third-party widget you cannot
  fix), use `exclude`/`disableRules` next to a comment with the ticket.
- axe finds roughly a third of WCAG issues. Keyboard order, focus visibility, screen reader
  output, zoom/reflow at 400 %, motion and content are checked by hand before release (checklist
  in [contracts/a11y-wcag.md](contracts/a11y-wcag.md)).

## In CI

Order (see [devops-handoff.md](devops-handoff.md)):

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @org/shell-<zone> exec playwright install --with-deps chromium
CI=true pnpm e2e:<zone>       # one job per zone (or pnpm e2e for all, sequentially)
```

- `CI=true`: fresh dev servers, 2 retries (a test that passes on retry is reported as flaky),
  `forbidOnly`, JUnit at `apps/<zone>/shell-<zone>/test-results/junit.xml` (publish it as test
  results) and the HTML report in `playwright-report/` (publish as an artefact, with
  `test-results/` for traces).
- Cache the Playwright browser folder (`~/.cache/ms-playwright` on Linux, keyed by the
  `@playwright/test` version in `pnpm-workspace.yaml`).
- Run a zone's e2e when anything in that zone or in `packages/` changed:
  `pnpm -s apps --affected --base=<sha> --zone=<zone> --json` is not `[]`.
- Unit tests and e2e must pass before merge; a11y violations fail the build like any other test.
