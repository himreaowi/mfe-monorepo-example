# Vendor kit: external modules

This kit is for teams that build a module which runs inside our portals but is developed
outside our code base. You do not need access to our repositories. You deliver a **hosted
bundle** that implements the **mount contract** below; we load it at runtime from a URL that is
configured per environment.

| File                           | What                                                                   |
| ------------------------------ | ---------------------------------------------------------------------- |
| `contract/mount-contract.d.ts` | The contract as TypeScript types (works for JS projects via JSDoc too) |
| `test-host/`                   | A page that loads your bundle the way our portals do and checks it     |
| `examples/vanilla/mount.js`    | Minimal module, format `esm`, no framework, no build                   |
| `examples/web-component/`      | The same as a custom element, format `web-component`                   |
| `CHECKLIST.md`                 | What we check before we accept a delivery                              |
| `VERSION.json`                 | Kit version and the contract version our portals implement             |

## The contract in one minute

Your bundle provides a `mount` function and the contract version it implements:

```ts
export const contractVersion = '1.0.0';

export function mount(element: HTMLElement, props: MountProps): MountedModule {
  // render into `element` (empty, owned by the portal)
  return {
    update(next: MountProps) {
      /* re-render with new props */
    },
    unmount() {
      /* remove everything you added */
    },
  };
}
```

`props` (see `contract/mount-contract.d.ts` for the full documentation):

| Prop              | Meaning                                                                                      |
| ----------------- | -------------------------------------------------------------------------------------------- |
| `contractVersion` | The portal's contract version                                                                |
| `basePath`        | URL path where the portal mounted you, e.g. `/payments`                                      |
| `path`            | Your current sub-path (`''`, `receipts/7`). Route on this, not on `window.location`          |
| `theme`           | `light` / `dark`. The portal's CSS custom properties (`--color-text`, …) are also inherited  |
| `locale`          | e.g. `en-SG`                                                                                 |
| `user`            | `{ id, name?, roles? }` or `null`. Opaque id only; ask your API for anything else            |
| `config`          | Your settings for this environment (from the portal's runtime configuration)                 |
| `onNavigate(to)`  | Ask the portal to navigate (`receipts/7` below `basePath`, or `/services` for a portal page) |
| `onEvent(n, d)`   | Business/analytics events (`payment:completed`)                                              |
| `onError(e)`      | Report errors. `fatal: true` makes the portal show its fallback panel with "Try again"       |

**Versioning:** we accept modules with the same MAJOR version as `VERSION.json`
`contractVersion`. New optional props are minor changes; you can ignore props you do not know.

**Authentication:** the portal never gives you tokens. Your API calls rely on the portal's
session cookie (same-site, `credentials: 'include'`) or your own backend integration agreed
with our backend team. Never store personal data in `localStorage`/`sessionStorage`.

## Delivery formats

Agree one with us; the portal's configuration names it:

| Format          | You deliver                                                                              | Portal configuration                                      |
| --------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `esm` (default) | An ES module exporting `contractVersion` and `mount`                                     | `{ "url": "https://…/mount.js", "format": "esm" }`        |
| `web-component` | A script defining a custom element with `static contractVersion`; we set `element.props` | `{ …, "format": "web-component", "tagName": "acme-pay" }` |
| `script`        | A classic script setting ONE namespaced global `{ contractVersion, mount }` (legacy)     | `{ …, "format": "script", "global": "AcmePayments" }`     |
| `mf`            | A Module Federation 2 remote exposing `./mount`, sharing nothing                         | `{ …, "format": "mf", "remoteName": "acme_pay" }`         |

Any framework (or none) is fine: React of any version, Vue, Svelte, Lit, Angular elements, plain
DOM. Bundle your framework with your module; do not expect anything from the page.

If your product cannot meet the contract (e.g. it needs the whole page, or must stay
isolated for security reasons), tell us early: we can integrate it in an `<iframe>` with
`postMessage` instead.

## Test your bundle with the test host

You need Node.js 20+ (no install step):

```sh
node test-host/serve.mjs            # http://localhost:3998/test-host/
```

Serve your bundle (with CORS enabled) and open:

```
http://localhost:3998/test-host/?url=http://localhost:5173/mount.js&format=esm&autoMount=1
```

Try the bundled example first:
`http://localhost:3998/test-host/?url=http://localhost:3998/examples/vanilla/mount.js&format=esm&autoMount=1`

The page uses the same loader code as our portals and a strict Content-Security-Policy. It:

- loads your bundle (`esm`, `web-component`, `script`) and checks `contractVersion`
- mounts it with sample props (edit `config`, `user`, theme, locale, path, container width)
- logs every `onNavigate` / `onEvent` / `onError` call and lifecycle step; `onNavigate`
  updates `path` and calls your `update()` like the portal does
- checks: mount time, `update()` present, no new globals, no styles added to the document,
  `unmount()` removes everything

All checks green and no errors in the browser console is the minimum for a delivery.

## Hosting requirements

- HTTPS, a stable versioned URL per release (e.g. `https://cdn.vendor.example/payments/1.4.2/mount.js`);
  files under a versioned URL never change (`Cache-Control: public, max-age=31536000, immutable`).
  A moving alias (`/latest/`) is not accepted in production.
- CORS: `Access-Control-Allow-Origin` for our portal origins (we send you the list per
  environment) on the bundle and every chunk/asset it loads.
- `Content-Type: text/javascript` for scripts.
- Publish the SRI hash (`sha384-…`) of the entry file with each release; we pin it.
- Your API must allow our portal origins (CORS) if the module calls it from the browser.
- Tell us every origin your module loads from or connects to (scripts, styles, images, fonts,
  APIs): our Content-Security-Policy allow-lists exactly these.

See `CHECKLIST.md` for the full acceptance list.
