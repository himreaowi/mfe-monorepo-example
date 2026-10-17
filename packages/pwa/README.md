# @org/pwa

PWA support ported from starter-mfe.

## Browser (`@org/pwa`)

- `registerPwa({ swUrl?, scope?, onError? })`: registers `/service-worker.js` after `load`. Call it
  only in the entry that owns the page (shell bootstrap, or a remote's standalone bootstrap). A
  remote rendered inside a shell never registers a service worker.
- `useOnlineStatus()`: `true`/`false` from `navigator.onLine` + `online`/`offline` events.

## Build (`@org/pwa/build`, Node, CommonJS)

- `PwaPlugin`: Rspack plugin used by `@org/rspack-config` for production shell builds. It emits
  the default `manifest.webmanifest` + `icons/` (unless the app's `public/` already provides them)
  and then runs Workbox **`workbox-build` `generateSW`** (not `workbox-webpack-plugin`, which
  imports webpack).
- `generateServiceWorker({ outputDir })`: the same Workbox step for any folder.
- Never precached: `mfe-manifest.json` (written per environment by DevOps), `mf-manifest.json`,
  `mf-stats.json`, `remoteEntry.js`, source maps. `mfe-manifest.json` is served network-first at
  runtime (the cached copy is used only offline). Documents are network-first too.

## Assets

`assets/manifest.webmanifest` and `assets/icons/icon-192.png`, `icon-512.png` are defaults.
Apps override them by putting their own files in `public/`.
