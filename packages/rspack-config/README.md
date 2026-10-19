# @org/rspack-config

Rspack 2 + Module Federation 2 (`@module-federation/enhanced/rspack`) config factories. They
replace starter-mfe's `webpack.common/dev/prod.js`. ESM only (`@rspack/core` 2 is ESM-only).

```js
// apps/intranet/shell/rspack.config.js
import { createShellConfig } from '@org/rspack-config';

export default createShellConfig({
  rootDir: import.meta.dirname,
  name: 'intranet_shell',
  port: 3100,
});
```

```js
// apps/intranet/staff-directory/rspack.config.js
import { createRemoteConfig } from '@org/rspack-config';

export default createRemoteConfig({
  rootDir: import.meta.dirname,
  name: 'intranet_staff_directory',
  port: 3101,
  // exposes defaults to { './App': './src/app/RemoteApp.tsx' }
});
```

Run with the Rspack CLI (`rspack dev`, `rspack build`). The app needs `@rspack/cli`,
`@rspack/core`, `@rspack/dev-server` and the tier-1 packages; loaders come from this package.
App TS code can use `"types": ["@org/rspack-config/client"]` for `*.module.scss` and asset
imports.

## What the factories set up

|                     | Shell (`createShellConfig`)                                               | Remote (`createRemoteConfig`)                 |
| ------------------- | ------------------------------------------------------------------------- | --------------------------------------------- |
| `output.publicPath` | `/` (deep links load chunks from the root)                                | `auto` (chunks load from the remote's origin) |
| MF `exposes`        | none                                                                      | `./App` → `./src/app/RemoteApp.tsx`           |
| MF `remotes`        | none: registered at runtime from `/mfe-manifest.json` (`@org/mf-runtime`) | none                                          |
| Dev manifest        | `mfe-manifest.dev.json` served as `/mfe-manifest.json`                    | n/a                                           |
| PWA (production)    | `PwaPlugin` from `@org/pwa/build` (Workbox `generateSW`)                  | off (option `pwa: true`)                      |

Shared by both:

- Entry `./src/main.tsx` (which must `import('./bootstrap')` so shared singletons are negotiated
  before React loads). `HtmlRspackPlugin` with `chunks: ['main']`; template `public/index.html` or
  the package default (`templates/index.html`).
- TS/TSX via `builtin:swc-loader` (automatic JSX runtime).
- SCSS/CSS via sass-loader + css-loader + **`CssExtractRspackPlugin` in development and
  production** (no style-loader): one `.css` per chunk (`[name].[contenthash:8].css` in
  production, `[name].css` + linked `.css.map` in development), loaded as
  `<link rel="stylesheet">` by the chunk loader before the chunk runs (a remote's CSS comes from
  its own origin, also when a shell loads it; a CSS file that fails rejects the load →
  `RemoteFallback`). No `<style>` elements, so the CSP has no `style-src 'unsafe-inline'`. CSS
  hot reload in development re-fetches the changed stylesheets (no page reload; adding or
  removing a class reloads the page). Why dev = prod and why not native CSS: docs/toolchain.md.
  CSS Modules: `[hash:base64:8]` in both modes (same class names in dev and prod), **hash salted
  with the federation name** so two apps never produce the same class name.
- **Dev server CSP** (`devCsp`, default on): the production rules (no `'unsafe-inline'` /
  `'unsafe-eval'`, `frame-src 'none'`, …) with any `http://localhost:*` origin and the HMR
  websockets allowed (`devContentSecurityPolicy()`). `devCsp: { extraOrigins: [...] }` when the
  dev manifest points at non-local origins, `{ frameSrc: [...] }` for iframes, `false` = no CSP.
  The dev-server error overlay (only shown on a build error) logs CSP errors for its inline
  colours.
- **Tier-1 singletons** (`TIER1_SINGLETONS`: react, react-dom, react-router, @org/ui, @org/auth) shared with
  `singleton: true, strictVersion: true, requiredVersion: <installed version>`. The installed
  version is the catalog version (or the workspace version for `@org/ui` / `@org/auth`), so any drift fails
  loudly at load time and the shell shows `RemoteFallback`. Extra `shared` entries can be passed.
- `index.html` script URLs are absolute (`htmlPublicPath`, default `/`), so a deep link or reload
  of a standalone remote (`/details`) still loads its entry.
- `lazyCompilation: false`; dev server with CORS `*`, history fallback for page navigations
  (`Accept: text/html`; other missing files stay 404 so HMR recovers after a failed build), HMR,
  `public/` as static.
- Production: `[name].[contenthash:8].js` / `.css` (8 hex: the nginx immutable-cache rule),
  **hidden source maps without sources**
  (`hidden-nosources-source-map`: `.map` files with mappings and file names, no
  `sourcesContent`, no `sourceMappingURL` comment; option `productionSourceMap`), no CSS maps
  (neither inline nor `.css.map`), `public/` copied except `index.html` and
  `mfe-manifest*.json` (the real manifest is written per environment by DevOps).
- `output.uniqueName` = federation name; `__MFE_NAME__` defined.
- Federation names must be JS identifiers (`intranet_staff_directory`); invalid names throw.

Restart `rspack dev` after changing the config (it does not reload config files).
