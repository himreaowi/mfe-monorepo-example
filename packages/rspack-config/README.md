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
- SCSS/CSS via sass-loader + css-loader + style-loader (styles travel with the exposed JS).
  CSS Modules: `[name]__[local]__[hash]` in dev, `[hash]` in prod, **hash salted with the
  federation name** so two apps never produce the same class name.
- **Tier-1 singletons** (`TIER1_SINGLETONS`: react, react-dom, react-router, @org/ui, @org/auth) shared with
  `singleton: true, strictVersion: true, requiredVersion: <installed version>`. The installed
  version is the catalog version (or the workspace version for `@org/ui` / `@org/auth`), so any drift fails
  loudly at load time and the shell shows `RemoteFallback`. Extra `shared` entries can be passed.
- `index.html` script URLs are absolute (`htmlPublicPath`, default `/`), so a deep link or reload
  of a standalone remote (`/details`) still loads its entry.
- `lazyCompilation: false`; dev server with CORS `*`, history fallback, HMR, `public/` as static.
- Production: `[name].[contenthash:8].js`, **hidden source maps without sources**
  (`hidden-nosources-source-map`: `.map` files with mappings and file names, no
  `sourcesContent`, no `sourceMappingURL` comment; option `productionSourceMap`), no inline CSS
  maps, `public/` copied except `index.html` and
  `mfe-manifest*.json` (the real manifest is written per environment by DevOps).
- `output.uniqueName` = federation name; `__MFE_NAME__` defined.
- Federation names must be JS identifiers (`intranet_staff_directory`); invalid names throw.

Restart `rspack dev` after changing the config (it does not reload config files).
