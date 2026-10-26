# Adding dependencies

Every app and package has its own `package.json` and its own `node_modules` (pnpm isolated
layout). Where a dependency's version lives depends on its **tier** (decision D4):

| Tier              | Examples                                                     | Version lives in                                    | Shared at runtime                                              | Different version needs      |
| ----------------- | ------------------------------------------------------------ | --------------------------------------------------- | -------------------------------------------------------------- | ---------------------------- |
| 1 Core singletons | `react`, `react-dom`, `react-router`, `@org/ui`, `@org/auth` | default catalog (`pnpm-workspace.yaml`) / workspace | Module Federation `singleton` + `strictVersion` (one instance) | exception (rarely granted)   |
| 2 Common libs     | `date-fns`, `zod` (used by 2+ apps/packages)                 | default catalog                                     | no, each app bundles its copy                                  | exception                    |
| 3 App-local       | a chart library used by one remote                           | that app's `package.json`, normal semver range      | no                                                             | nothing, it is the app's own |

`pnpm check` (also run by `pnpm lint` and CI) enforces the tiers. See
[guardrails.md](guardrails.md) for every message and its fix.

## Tier 3: a library only your app uses

```sh
pnpm --filter @org/intranet-staff-directory add chart.js
pnpm --filter @org/intranet-staff-directory add -D @types/some-lib
```

`catalogMode: manual` writes a normal range (`"chart.js": "^4.5.1"`) into that app only. Nothing
else to do. Use the app's package name (`@org/<zone>-<name>`, see its `package.json`).

## Tier 2: a library a second app/package needs (promote to the catalog)

As soon as two workspace packages depend on the same third-party library, it must have one version
in the catalog. Adding it to the second app with a plain range fails `pnpm check`:

```
error   [check-versions/shared-not-in-catalog] chart.js is used by 2 workspace packages without the catalog: @org/internet-services ("^4.5.0"), @org/intranet-staff-directory ("^4.5.1"). ...
    Fix: add "chart.js: 4.5.1" under "catalog:" in pnpm-workspace.yaml, then point every user at it: pnpm --filter @org/internet-services add chart.js@catalog: && pnpm --filter @org/intranet-staff-directory add chart.js@catalog:.
```

Steps:

1. Add an exact version under `catalog:` in `pnpm-workspace.yaml` (pick one that is at least a day
   old, see `minimumReleaseAge` in [toolchain.md](toolchain.md)):

   ```yaml
   catalog:
     chart.js: 4.5.1
   ```

2. Point every user at the catalog (this rewrites the spec to `catalog:` and installs):

   ```sh
   pnpm --filter @org/intranet-staff-directory add chart.js@catalog:
   pnpm --filter @org/internet-services add chart.js@catalog:
   ```

   Re-adding without `@catalog:` (`pnpm --filter <app> add chart.js`) keeps the app's existing
   `^x.y.z` range; `pnpm check` then reports `catalog-bypassed`. Editing the `package.json` to
   `"chart.js": "catalog:"` and running `pnpm install` works too.

3. `pnpm check`.

**Upgrading** a catalog library: change the version in `pnpm-workspace.yaml`, `pnpm install`, then
`pnpm lint && pnpm typecheck && pnpm test && pnpm build`. Every app moves together.

A library that holds cross-app state or React context (router, query cache, i18n, global store)
is not tier 2: it must be tier 1, otherwise a remote gets its own copy and its own context (see
the negative control in [toolchain.md](toolchain.md)).

## Tier 1: core singletons

`react`, `react-dom`, `react-router`, `@org/ui` and `@org/auth` are listed in `TIER1` in
`tools/scripts/src/tiers.js` and in `TIER1_SINGLETONS` in `packages/platform/webpack-config/src/tier1.js`
(check-versions fails if the two lists differ). `@org/webpack-config` shares them with
`singleton: true, strictVersion: true, requiredVersion: <catalog version>`: an app built against
another version fails loudly when the shell loads it, and the shell shows `RemoteFallback`.

Apps always reference them as `catalog:` (`workspace:*` for `@org/ui` and `@org/auth`). The generators do this.

### Requesting an exception

Only when an app truly cannot use the catalog version (tier 1 or tier 2), add an entry to
`version-exceptions.json` in the same pull request that changes the app's `package.json`:

```json
{
  "exceptions": [
    {
      "package": "date-fns",
      "version": "3.6.0",
      "app": "@org/intranet-leave-requests",
      "reason": "Calendar widget pins date-fns 3; upgrade tracked in LEAVE-42",
      "owner": "team-leave@example.com",
      "expires": "2027-03-31"
    }
  ]
}
```

- All six fields are required. `app` is the package name; `version` must match the app's spec
  (`3.6.0` matches `3.6.0`, `^3.6.0` and `~3.6.0`); `reason` explains why (10+ characters);
  `expires` is a real date `YYYY-MM-DD`. Unknown fields fail.
- An expired entry fails `pnpm check`: move the app back to `catalog:` or renew the entry (new date,
  updated reason, reviewed again).
- An entry that no longer matches anything is reported as a warning: delete it.
- **Tier 1:** a different _major_ of React (or react-router) cannot share the runtime singleton.
  Such an app is integrated as an isolated mount-contract module (`--external` adapter, see
  [external-modules.md](external-modules.md)), not as a plain remote. A tier-1 exception for a patch/minor
  difference still fails at runtime because of `strictVersion`; expect it to be refused.

### Adding a new tier-1 package

Add it to the default catalog, to `TIER1` in `tools/scripts/src/tiers.js` and to
`TIER1_SINGLETONS` in `packages/platform/webpack-config/src/tier1.js` in one pull request, then restart every
dev server (webpack-dev-server does not reload config files).

## What CI says

CI runs `pnpm install --frozen-lockfile` and then `pnpm lint` (which runs `pnpm check` first).
Every message names the package, the file and the fix, for example:

```
error   [check-versions/tier1-pinned] @org/intranet-staff-directory (apps/intranet/staff/staff-directory/package.json dependencies): "react": "18.3.1" — react is in the catalog (19.3.1) and is a tier-1 singleton shared at runtime, so it must be "catalog:".
    Fix: set "react": "catalog:" (or run: pnpm --filter @org/intranet-staff-directory add react@catalog:).
    If @org/intranet-staff-directory really needs 18.3.1, add an exception to version-exceptions.json: { ... }. A different major of a tier-1 package cannot share the runtime singleton: integrate the app as an isolated mount-contract module (docs/external-modules.md).
✖ check-versions, check-apps: 1 error. How to fix each one: docs/guardrails.md
```

Note: `pnpm <script>` first installs when `package.json` files changed since the last install
(pnpm 12 `verifyDepsBeforeRun`), so `pnpm check` after editing a `package.json` may update the
lockfile. `node tools/scripts/bin/check.js` runs the checks without that step.
