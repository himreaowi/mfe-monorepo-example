# @org/example-vendors (dev only)

Two **example vendor products** for the external adapters of the example zones. Like real
vendors (decision D3) they are written without React and without our repo: they only use the
mount contract types from the vendor kit (`@org/vendor-kit/contract`). In production the vendor
hosts its own files and the manifest points at its CDN.

```sh
pnpm --filter @org/example-vendors dev      # http://localhost:3990
```

| Vendor (fictional)               | URL                                               | Format          | Used by                |
| -------------------------------- | ------------------------------------------------- | --------------- | ---------------------- |
| Acme Service Desk, ticket widget | `http://localhost:3990/helpdesk/1.0.0/mount.js`   | `esm`           | intranet `it-helpdesk` |
| Bright Payments, checkout        | `http://localhost:3990/payments/2.3.1/element.js` | `web-component` | internet `payments`    |

**Acme Service Desk** (`src/helpdesk/`): lists the user's IT tickets, a "Report a problem" form
(validation, accessible error summary) and a ticket page. Routes on `props.path` (`''`, `new`,
`tickets/<id>`) through `props.onNavigate`, calls its own API at `props.config.apiBaseUrl` (the
mock API's `/helpdesk/*` endpoints in development) and reports `ticket:created` through
`props.onEvent`, API failures through `props.onError` (non-fatal).

**Bright Payments** (`src/payments/`): custom element `<bright-checkout>` showing the bill from
`props.config` (`description`, `amount` in cents, `currency`, `title`), a payment-method choice
and "Pay". It talks back with the contract's CustomEvents instead of callbacks:
`external:event` `payment:completed { reference, amount, currency, method, description }`,
`external:navigate` to `receipt/<reference>`, and a fatal `external:error` when the config is
invalid.

Both render in an open shadow root with a constructable stylesheet that reads the host's CSS
custom properties (light and dark themes) and meet WCAG 2.2 AA (checked by the zone e2e axe
scans). Started by `pnpm dev:<zone>` through the adapters' `nx.targets.dev.dependsOn`. Never
deploy this package.
