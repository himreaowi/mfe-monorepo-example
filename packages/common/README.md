# packages/common

Business logic used by **both zones** (intranet and internet): one package per capability,
`packages/common/<capability>` → `@org/common-<capability>`. Create one with
`pnpm gen:package common <capability>`.

**Everything here ships to the internet portals.** No confidential or intranet-only rules, no
internal URLs, no secrets. Client-side rules are a convenience: the backend must enforce the same
rules.

A common package imports only other `packages/common/*` and `packages/platform/*` packages, never
zone code (`pnpm check`: `package-boundaries`). Code for one zone only goes to
`apps/<zone>/libs/<capability>`. See [docs/where-code-goes.md](../../docs/where-code-goes.md).
