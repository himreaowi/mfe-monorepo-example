# Delivery checklist (external modules)

We check every release against this list before it goes to a production portal. Run the
test host (`README.md`) first; most items show up there.

## Contract

- [ ] Exports `contractVersion` with the same MAJOR as the kit's `VERSION.json` (`1.x.x`)
- [ ] `mount(element, props)` renders only inside `element` and returns `{ unmount(), update?() }`
- [ ] `update(props)` applies new `theme`, `path`, `user`, `config` without a full reload
      (if missing, we remount on every change, which loses state)
- [ ] `unmount()` removes all DOM, event listeners, timers, observers, sockets and subscriptions
      (test host: "unmount() removed everything")
- [ ] Mounting, unmounting and mounting again on the same page works (no "already defined"
      errors, no duplicate listeners)
- [ ] Routing uses `props.path` + `props.onNavigate`; the module never calls
      `history.pushState`/`location.assign` itself
- [ ] Handles `user: null` (signed out) and ignores unknown props

## No side effects outside the mount element

- [ ] No globals on `window` (exception: format `script`, exactly one namespaced global)
- [ ] Custom element names and any storage keys use a vendor prefix (`acme-…`)
- [ ] No global CSS: styles in a shadow root (recommended) or fully prefixed class names; no
      `*`, `html`, `body`, element selectors or CSS resets that reach outside the module
      (test host: "no styles added to the document")
- [ ] Does not change `document.title`, `<html>` attributes, fonts, the viewport or scroll
      position of the page
- [ ] Bundles its own framework/polyfills; does not patch built-ins or depend on page globals
- [ ] No service worker registration

## Security and CSP

- [ ] Works under our CSP: no `eval`/`new Function`/string timers, no inline `<script>`, no
      inline event handlers; styles via constructable stylesheets (`adoptedStyleSheets`) or a
      `<link>` from your allow-listed origin. No `<style>` elements (not even inside your
      shadow root) and no `style="…"` attributes in HTML strings: our CSP has no
      `'unsafe-inline'` for styles (`element.style.*` set from JavaScript is fine). The test
      host reports every CSP violation as a failed check
- [ ] Complete list of origins delivered (script, style, img, font, connect, frame)
- [ ] No tokens, NRIC/FIN or other personal data in URLs, logs, `localStorage` or
      `sessionStorage`; only what your API needs, over HTTPS
- [ ] Third-party scripts (analytics, chat, tag managers) only if agreed in writing
- [ ] SRI hash (`sha384-…`) published for the entry file of each release
- [ ] Dependencies scanned (no known critical/high vulnerabilities); SBOM available on request

## Errors and resilience

- [ ] Every caught error is reported with `props.onError({ code, message, fatal? })`; `fatal`
      only when the module cannot continue
- [ ] No uncaught exceptions or unhandled promise rejections (test host log shows none)
- [ ] Loads and mounts in under 3 s on a mid-range phone over 4G (test host shows mount time)
- [ ] Shows its own loading and error states for slow/failed API calls

## Accessibility (WCAG 2.2 AA)

- [ ] Keyboard: everything reachable and operable, visible focus (2.4.7, 2.4.11), no traps
- [ ] Semantic HTML / correct ARIA roles, names and states; headings start at the level we agree
      (usually `h2`)
- [ ] Contrast: text 4.5:1, large text and UI components 3:1, in **light and dark** themes
- [ ] Target size at least 24×24 CSS px (2.5.8); works at 320 CSS px width and 400 % zoom
- [ ] Status messages announced (`role="status"`/`aria-live`), errors identified in text
- [ ] Respects `prefers-reduced-motion`
- [ ] Tested with axe (0 violations) and a screen reader (NVDA or VoiceOver)

## Hosting

- [ ] HTTPS, versioned immutable URL per release, `Content-Type: text/javascript`
- [ ] CORS for our portal origins on the bundle and all its chunks/assets
- [ ] Release notes: version, contract version, SRI hash, changed origins, migration notes
- [ ] A support contact and an availability/uptime commitment for the hosted files
