# @org/example-vendors (dev only)

Two **example vendor products** for the external adapters of the example zones. Like real
vendors (decision D3) they are written without React and without our repo: they only use the
mount contract types from the vendor kit (`@org/vendor-kit/contract`). In production the vendor
hosts its own files and the manifest points at its CDN.

```sh
pnpm --filter @org/example-vendors serve:intranet   # http://localhost:3192 (helpdesk)
pnpm --filter @org/example-vendors serve:internet   # http://localhost:3292 (payments)
```

One server per zone, serving only that zone's vendor, on the zone's dev-tools range
(`toolPort(zone, 'exampleVendors')` in `tools/scripts/src/zones.js`: intranet 3190–3199,
internet 3290–3299), so both zones run at the same time. `--port <n>` serves every vendor.

| Vendor (fictional)               | URL                                               | Format          | Used by                |
| -------------------------------- | ------------------------------------------------- | --------------- | ---------------------- |
| Acme Service Desk, ticket widget | `http://localhost:3192/helpdesk/1.0.0/mount.js`   | `esm`           | intranet `it-helpdesk` |
| Bright Payments, checkout        | `http://localhost:3292/payments/2.3.1/element.js` | `web-component` | internet `payments`    |

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
scans). Started by `pnpm dev:<zone>` through the adapters' `nx.targets.dev.dependsOn`
(`@org/example-vendors:serve:<zone>`). The zone e2e suites run the generic external-adapter
test against them; the mock-vendor-only checks skip. Never
deploy this package.
