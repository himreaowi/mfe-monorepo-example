# @org/mock-vendor (dev only)

A mock **external/vendor module** for local development and tests. Written without React (plain
DOM, shadow DOM, a custom element) to prove that the mount contract is framework-agnostic. It
only uses the vendor kit's contract types (`@org/vendor-kit/contract`), like a real vendor.

```sh
pnpm --filter @org/mock-vendor dev      # http://localhost:3999
```

| URL                                | Format          | Manifest `vendor` config                                                                |
| ---------------------------------- | --------------- | --------------------------------------------------------------------------------------- |
| `http://localhost:3999/mount.js`   | `esm`           | `{ "url": "http://localhost:3999/mount.js", "format": "esm" }`                          |
| `http://localhost:3999/element.js` | `web-component` | `{ "url": "…/element.js", "format": "web-component", "tagName": "mock-vendor-widget" }` |
| `/__down` / `/__down?value=0`      |                 | simulate a vendor outage (module requests answer 503) / restore                         |

What it does: renders a "payment" widget in a shadow root (scoped styles, host CSS variables),
routes between overview and `receipt/<ref>` via `props.path` + `onNavigate`, sends
`payment:completed` through `onEvent`, a non-fatal and a fatal error through `onError`, and logs
`[mock-vendor] mount|update|unmount` to the console. `config.title` and `config.amount` (cents)
come from the manifest.

The generated `--external` adapter remotes use it in development: the shell's
`mfe-manifest.dev.json` points at it, the adapter falls back to it in development builds when no
`vendor` config is set, and `nx dev <adapter>` starts it (task dependency). Production builds
contain neither the fallback nor the URL. Never deploy this package.
