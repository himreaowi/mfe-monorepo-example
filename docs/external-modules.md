# External modules (vendors and other frameworks)

How to integrate UI that is **not** built in this repo with our React/Module Federation stack:
vendor products (decision D3: vendors have no repo access), apps on another framework, or apps on
another React major. Vendor-facing material is in `packages/vendor-kit` (packed as a zip).

## Which integration?

| Situation                                                                                                                    | Integration                                                                                                                          | Isolation                                                        |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| React app built **with our exact tier-1 versions** (react, react-dom, react-router, `@org/ui`, `@org/auth` from the catalog) | **Plain runtime remote** (`pnpm gen:remote`). Shares the singletons, uses the shell's router, theme and auth context                 | none (same React tree)                                           |
| **Other framework** (Vue, Angular, Svelte, Lit, plain JS) or **another React version**, from a vendor we trust               | **Mount-contract adapter** (`pnpm gen:remote <zone> <name> --external`) + `<ExternalModule>`: `esm`, `web-component`, `script`, `mf` | own framework instance, own DOM subtree (shadow DOM recommended) |
| **Untrusted** or legacy code, needs the whole page, or must be isolated for compliance (e.g. a hosted payment page)          | **iframe + postMessage** (documented pattern below; no generator)                                                                    | separate origin / browsing context                               |

A vendor who could match our versions still integrates through the mount contract: they cannot
see our catalog or follow our upgrades, and a singleton mismatch fails at runtime
(`strictVersion`). Plain remotes are for teams working in this repo.

A mount-contract module runs **in our page, on our origin**. It can read the DOM and call our
same-origin APIs with the user's session cookie. Only vetted vendors with a contract go this way;
everything else goes in an iframe.

## The mount contract (v1)

Source of truth: `packages/mf-runtime/src/external/contract.ts` (`MOUNT_CONTRACT_VERSION`),
shipped to vendors as `mount-contract.d.ts` in the vendor kit (generated, checked by tests).

```ts
export const contractVersion = '1.0.0'; // the module declares what it implements
export function mount(
  element: HTMLElement,
  props: MountProps,
): MountedModule | Promise<MountedModule>;

interface MountedModule {
  update?(props: MountProps): void; // missing → the host remounts on prop changes
  unmount(): void | Promise<void>; // remove all DOM, listeners, timers
}

interface MountProps {
  contractVersion: string; // host's version
  basePath: string; // '/payments'
  path: string; // sub-path below basePath: '' | 'receipt/7' (vendor routes on it)
  theme: 'light' | 'dark';
  locale: string; // 'en-SG'
  user: { id: string; name?: string; roles?: string[] } | null; // PDPA-minimal, no tokens
  config: Readonly<Record<string, unknown>>; // from the manifest, per environment
  onNavigate(to: string, options?: { replace?: boolean }): void; // relative or '/host-route'
  onEvent(name: string, detail?: unknown): void; // business/analytics events
  onError(error: {
    code: string;
    message: string;
    fatal?: boolean;
    detail?: unknown;
  }): void;
}
```

- **Versioning:** the host accepts a module whose `contractVersion` has the same MAJOR. Adding an
  optional prop/callback is MINOR (modules ignore unknown props). Removing/renaming or changing
  behaviour is MAJOR: support both majors in `<ExternalModule>` for a transition period and tell
  every vendor.
- `web-component` modules expose `static contractVersion` on the element class; the host sets
  `element.props` and may receive `external:navigate|event|error` `CustomEvent`s instead of
  callback calls (`EXTERNAL_EVENTS`).

## How it fits together

```
shell ──<RemoteApp name="internet_payments">──▶ adapter remote (our React, gen:remote --external)
                                                  └─ <ExternalModule config={props.vendor} …>
                                                        └─ load vendor bundle → mount(div, props)
mfe-manifest.json (per environment, DevOps):
  "internet_payments": { "entry": ".../mf-manifest.json",
                         "props": { "vendor": { "url", "format", "integrity", "config" } } }
```

- The adapter remote is a normal remote: own route (`/payments/*`), registry entry, access tag
  (`--private` works too, so a vendor module can sit behind `<RequireAuth>`), error boundary.
- `src/features/external/components/ExternalModuleHost/ExternalModuleHost.tsx` passes `basePath`, the splat sub-path as `path`,
  the shell theme, the user (reduced to `{ id, name, roles }`) and wires `onNavigate` to the
  shell router. `onEvent`/`onError` go to a demo panel: replace with real handling.
- **The vendor URL is never in a build**: it comes from the manifest. Development: the shell's
  `mfe-manifest.dev.json` points at the mock vendor and `utils/vendorConfig.ts` falls back to it when no
  config is set (standalone). Both are dropped from production builds (verified by grep; a
  development build contains the URL).

### `<ExternalModule>` (`@org/mf-runtime/external`)

| Prop                                          | Meaning                                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `name`                                        | label for messages/logs                                                                                |
| `config`                                      | `ExternalModuleConfig` (validated; invalid → fallback "Module not configured")                         |
| `basePath`, `path`, `theme`, `locale`, `user` | passed to the module; changes → `update()` (or remount without `update`)                               |
| `onNavigate`, `onEvent`, `onError`            | host callbacks; `onError` gets load failures (`source: 'host'`) and module errors (`source: 'module'`) |
| `loading`, `className`, `load`                | loading UI, wrapper class, loader override (tests)                                                     |

`ExternalModuleConfig` (`props.vendor` in the manifest):

| Key                        | Formats                    | Meaning                                                                     |
| -------------------------- | -------------------------- | --------------------------------------------------------------------------- |
| `url`                      | all                        | bundle URL (https, or root-relative). `mf`: the remote's `mf-manifest.json` |
| `format`                   |                            | `esm` (default choice), `web-component`, `script`, `mf`                     |
| `exportName`               | esm                        | named export holding `{ contractVersion, mount }` (default: the module)     |
| `tagName`, `scriptType`    | web-component              | custom element name; load the script as `module` (default) or `classic`     |
| `global`                   | script                     | the one global the script sets (`Acme.Payments`)                            |
| `remoteName`, `expose`     | mf                         | vendor federation name; exposed module (default `./mount`)                  |
| `integrity`, `crossOrigin` | esm, script, web-component | SRI hash (`sha384-…`), CORS mode (default `anonymous`)                      |
| `timeoutMs`                | all                        | load + mount timeout (default 15000)                                        |
| `config`                   | all                        | passed to the module as `props.config`                                      |

Behaviour:

- `esm`: native `import(url)` (left alone by Rspack via `webpackIgnore`). With `integrity`, a
  `<link rel="modulepreload" integrity>` fetches and verifies the module first; the import then
  reuses it. A wrong hash is refused by the browser (verified in the test host).
- `script` / `web-component`: a `<script>` with `integrity` + `crossorigin`, cached per URL;
  `web-component` waits for `customElements.whenDefined`.
- `mf`: `registerRemotes` + `loadRemote('<remoteName>/mount')`. The vendor remote must not declare
  `shared` modules (it brings its own framework). No SRI (MF loads chunks itself): pin a
  versioned URL.
- Contract check, then `mount` into a dedicated `<div>` (React never renders into it).
- Prop changes → `update(props)`; same values in new objects do not trigger updates.
- Leaving the route → `unmount()`. A `mount()` that resolves after unmount/timeout is unmounted.
- Failures → `RemoteFallback` with "Try again": invalid config, network/CORS/CSP/SRI errors,
  timeout, missing `mount`/`unmount`, other contract major, `mount`/`update` throwing, or the
  module calling `onError({ fatal: true })`. "Try again" reloads with a `mfeRetry=<n>` query
  parameter, because browsers may cache a failed module URL. Non-fatal `onError` is only
  reported. The shell and its other routes keep working.

## Security

- **CSP** (shell's nginx, written by DevOps per environment): add exactly the vendor origins
  the vendor declares: `script-src` (bundle and chunks), `connect-src` (their APIs),
  `style-src`/`font-src`/`img-src` if they load such files, `frame-src` for iframes. Never
  `'unsafe-eval'` or `'unsafe-inline'` for a vendor; constructable stylesheets / shadow DOM need
  neither. The vendor kit test host runs under a comparable CSP.
- **SRI**: pin `integrity` per release in the manifest (the vendor publishes it with each
  versioned URL). A changed file then fails closed instead of running.
- **Versioned, immutable URLs** only (`/payments/1.4.2/mount.js`), no `/latest/` in production;
  upgrading = changing `url` + `integrity` in the manifest (no rebuild, easy rollback).
- **Data**: the contract carries no tokens and a PDPA-minimal user. Our session cookie is
  HttpOnly, but code running in our origin can still make credentialed requests to our BFF:
  that is why mount-contract modules are for vetted vendors only.
- **CORS**: the vendor's CDN allows our portal origins; our APIs do not allow the vendor's
  origin unless agreed.

### iframe + postMessage (untrusted / legacy)

Not generated; build it inside an adapter remote when needed:

```tsx
<iframe
  src={vendor.url} // per environment, from the manifest
  title="Payment" // accessible name
  sandbox="allow-scripts allow-forms allow-popups" // add allow-same-origin ONLY for a different origin
  allow="payment"
  referrerPolicy="strict-origin"
  style={{ width: '100%', border: 0, height }}
/>
```

- Host → iframe: `iframe.contentWindow.postMessage({ type: 'mfe:props', version: 1, props }, vendorOrigin)`
  (serialisable props only: theme, locale, path, minimal user, config).
- iframe → host: `{ type: 'mfe:navigate' | 'mfe:event' | 'mfe:error' | 'mfe:resize', version: 1, … }`.
  Accept a message only if `event.origin === vendorOrigin` **and**
  `event.source === iframe.contentWindow`; validate the payload; never `eval` or inject HTML from it.
- Always pass an explicit `targetOrigin` (never `'*'`). CSP `frame-src <vendor origin>`; the vendor
  sets `frame-ancestors <our origins>`. Resize via `mfe:resize` (height) or a fixed height.
- Keyboard focus moves into the iframe naturally; give it a `title`, and make sure the vendor page
  itself meets WCAG 2.2 AA.

## Onboarding a vendor, step by step

1. **Decide the integration** with the table above (security review for anything touching
   personal data or payments).
2. **Agree** the format (`esm` recommended), the contract version (`MOUNT_CONTRACT_VERSION`), the
   `config` keys, events/error codes, and the origins they need (script, connect, style, img,
   font).
3. **Send the vendor kit**: `pnpm --filter @org/vendor-kit pack:kit` →
   `packages/vendor-kit/dist/org-vendor-kit-<version>.zip` (or publish it to Azure Artifacts).
   It contains the contract types, the test host, examples and `CHECKLIST.md`.
4. The vendor builds and tests with the **test host** (`node test-host/serve.mjs`), then delivers:
   versioned HTTPS URL per environment, SRI hash, origin list, release notes, support contact.
5. **Create the adapter**: `pnpm gen:remote <zone> <name> --external [--private]`, `pnpm install`.
   Put the vendor's test URL (or keep the mock) in the shell's `mfe-manifest.dev.json`
   `props.vendor`, and run `pnpm dev:<zone>`.
6. **Review** against `CHECKLIST.md`: contract behaviour, no globals/global CSS, CSP, errors,
   WCAG 2.2 AA (keyboard, contrast in light and dark, screen reader), performance.
7. **DevOps**: per environment, `props.vendor` (`url`, `integrity`, `config`) in the shell's
   `mfe-manifest.json`; CSP allow-list in the shell's nginx; the vendor allows our origins (CORS).
8. **Test** in staging (e2e with the real vendor URL; the mock vendor in CI).
9. **Upgrades**: new versioned URL + SRI → manifest change only. Contract MAJOR change: plan with
   every vendor, support both majors during the transition.

## Different React major (D4 version exceptions)

Tier-1 packages are Module Federation singletons with `strictVersion`. A remote built against
another React (or react-router) version fails to load in the shell, by design. `check-versions`
rejects such a pin (`tier1-pinned`) and points here. A version exception does not help for tier 1:
the runtime still fails, so exceptions for tier-1 packages are refused.

An app that must stay on another React major (e.g. a legacy React 18 app, or a product on
React 20 before we upgrade) is integrated as an **isolated mount-contract module**:

1. It is built **outside this workspace's catalog**: its own repository or pipeline (the usual
   case, like a vendor), bundling its own React. It shares nothing with the host.
2. It exposes `mount(el, props)`: for React, `createRoot(el).render(<App {...props} />)`, with
   `update` re-rendering and `unmount` calling `root.unmount()`. Delivered as `esm` (or `mf` without
   `shared`).
3. In this repo it gets an adapter: `pnpm gen:remote <zone> <name> --external`, configured from
   the manifest like any vendor.
4. Its React context does not cross the boundary: router, theme and auth arrive as contract props
   (`path` + `onNavigate`, `theme`, `user`), not as shared providers.

When the app catches up with our React version, it can become a plain remote again.

## Local development

| What                   | How                                                                                                                                                                                                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mock vendor (no React) | `tools/mock-vendor`, one per zone (intranet http://localhost:3191, internet :3291): `/mount.js` (`esm`), `/element.js` (`web-component`), `/script.js` (`script`), `/__down` simulates an outage; a neutral demo widget with a generic `config` (`title`, `message`) |
| Generated config       | `pnpm gen:remote <zone> <name> --external [--vendor-format esm\|web-component\|script]` writes `props.vendor` for the zone's mock vendor into the dev manifest; replace it with the real vendor's URL/format/config when it delivers                                 |
| Started automatically  | the adapter's `nx.targets.dev.dependsOn` (`@org/mock-vendor:serve:<zone>`) → `pnpm dev:<zone>` and `pnpm exec nx dev <adapter>` start it                                                                                                                             |
| e2e                    | the zone suite checks **any** vendor generically (mounted content, no fallback, no console errors, unmount); mock-vendor-only checks skip with a reason when `props.vendor` points elsewhere                                                                         |
| Test a vendor bundle   | `pnpm --filter @org/vendor-kit serve` → http://localhost:3998/test-host/?url=…&format=esm&autoMount=1                                                                                                                                                                |
| Change the contract    | edit `packages/mf-runtime/src/external/contract.ts`, then `pnpm --filter @org/vendor-kit generate:contract` and bump the kit version                                                                                                                                 |
