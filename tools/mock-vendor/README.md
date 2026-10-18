# @org/mock-vendor (dev only)

A mock **external/vendor module** for local development and tests. Written without React (plain
DOM, shadow DOM, a custom element) to prove that the mount contract is framework-agnostic. It
only uses the vendor kit's contract types (`@org/vendor-kit/contract`), like a real vendor. It
shows a **neutral demo widget**: nothing product-specific, so any `--external` adapter can use it
until the real vendor delivers.

One server per zone, on the zone's mock-vendor port (tools range in
`tools/scripts/src/zones.js`, offset `mfe.tools.mockVendor` in the root `package.json`), so `pnpm dev:intranet` and `pnpm dev:internet` can run together:

```sh
pnpm --filter @org/mock-vendor serve:intranet   # http://localhost:3191
pnpm --filter @org/mock-vendor serve:internet   # http://localhost:3291
```

| Path                          | Format          | Manifest `vendor` config (intranet port shown)                                                |
| ----------------------------- | --------------- | --------------------------------------------------------------------------------------------- |
| `/mount.js`                   | `esm`           | `{ "url": "http://localhost:3191/mount.js", "format": "esm" }`                                |
| `/element.js`                 | `web-component` | `{ "url": "…/element.js", "format": "web-component", "tagName": "mock-vendor-widget" }`       |
| `/script.js`                  | `script`        | `{ "url": "…/script.js", "format": "script", "global": "MockVendor" }` (classic script, IIFE) |
| `/__down` / `/__down?value=0` |                 | simulate a vendor outage (module requests answer 503) / restore                               |

What it does: renders a demo widget in a shadow root (scoped styles, host CSS variables), routes
between overview and `details/<n>` via `props.path` + `onNavigate`, sends `demo:action` through
`onEvent`, a non-fatal and a fatal error through `onError`, and logs
`[mock-vendor] mount|update|unmount` to the console. Optional `config.title` and
`config.message` come from the manifest (`props.vendor.config`). Test ids: `mock-vendor`,
`mock-vendor-path`, `mock-vendor-theme`, `mock-vendor-user`, `mock-vendor-details`.

The generated `--external` adapter remotes use it in development: the shell's
`mfe-manifest.dev.json` points at it (format from `pnpm gen:remote … --external
--vendor-format esm|web-component|script`), the adapter falls back to it in development builds
when no `vendor` config is set, and `pnpm dev:<zone>` / `nx dev <adapter>` start it (task
dependency `serve:<zone>`). Production builds contain neither the fallback nor the URL. Never
deploy this package.
