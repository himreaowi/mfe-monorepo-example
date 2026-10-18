# Guardrails

| Command      | Runs                                                                    |
| ------------ | ----------------------------------------------------------------------- |
| `pnpm check` | `check-versions` + `check-apps` (`tools/scripts`, a few hundred ms)     |
| `pnpm lint`  | `pnpm check`, then ESLint in every project (incl. Nx module boundaries) |

Run one check only: `node tools/scripts/bin/check.js --only versions` (or `--only apps`).
Errors fail the command; warnings are printed but do not fail. Every message starts with
`[check/rule]`; find the rule below.

## check-versions (dependency tiers, D4)

Background and commands: [adding-dependencies.md](adding-dependencies.md). Only `dependencies`,
`devDependencies` and `optionalDependencies` are checked; `peerDependencies` are compatibility
ranges and may stay ranges.

| Rule                         | Fails when                                                                                                                                                                                                       | Fix                                                                                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tier1-pinned`               | an app/package pins react, react-dom or react-router instead of `catalog:`                                                                                                                                       | `"react": "catalog:"` (or `pnpm --filter <app> add react@catalog:`). A different major needs an isolated mount-contract module, not an exception |
| `catalog-bypassed`           | a catalog package (e.g. `typescript`) is written with a version instead of `catalog:`                                                                                                                            | `pnpm --filter <app> add <pkg>@catalog:`, or add a justified entry to `version-exceptions.json`                                                  |
| `shared-not-in-catalog`      | the same third-party package is used by 2+ workspace packages without the catalog                                                                                                                                | add `<pkg>: <version>` under `catalog:` in `pnpm-workspace.yaml`, then `pnpm --filter <each user> add <pkg>@catalog:`                            |
| `exception-expired`          | a `version-exceptions.json` entry's `expires` is before today                                                                                                                                                    | move the app back to `catalog:` and delete the entry, or renew it (new date + reason, reviewed)                                                  |
| `exceptions-malformed`       | the file is not `{ "exceptions": [...] }`, a field is missing/empty/unknown, the date is not a real `YYYY-MM-DD`, the reason is under 10 characters, `app` is not a workspace package, or an entry is duplicated | fix the entry as the message says                                                                                                                |
| `exception-mismatch`         | an exception exists but its `version` differs from the app's spec                                                                                                                                                | make `version-exceptions.json` and the app's `package.json` agree                                                                                |
| `exception-unused` (warning) | an exception matches no dependency                                                                                                                                                                               | delete the entry                                                                                                                                 |
| `tier1-drift`                | `TIER1` (`tools/scripts/src/tiers.js`) differs from `TIER1_SINGLETONS` (`packages/rspack-config/src/tier1.js`)                                                                                                   | change both lists together                                                                                                                       |
| `tier1-missing`              | a tier-1 package is not in the default catalog (or `@org/ui` / `@org/auth` is not a workspace package)                                                                                                           | add it to the catalog                                                                                                                            |
| `catalog-missing`            | `"<pkg>": "catalog:"` but the catalog has no entry for it                                                                                                                                                        | add the entry to `pnpm-workspace.yaml`                                                                                                           |
| `workspace-protocol`         | a workspace package (`@org/*`) is referenced with a version                                                                                                                                                      | `"@org/x": "workspace:*"`                                                                                                                        |
| `workspace-unknown`          | `workspace:*` for a package that does not exist                                                                                                                                                                  | fix the name or remove it                                                                                                                        |

## check-apps (app metadata and boundaries backstop)

| Rule                                   | Fails when                                                                                                                                                                                                                                                         | Fix                                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `app-location`                         | a `package.json` under `apps/` is not at `apps/<intranet\|internet>/<name>/`                                                                                                                                                                                       | move it, or create apps with `pnpm gen:shell` / `pnpm gen:remote`                                     |
| `app-tags`                             | `nx.tags` is missing, or does not have exactly one `zone:<folder zone>`, one `type:shell\|remote`, one `access:public\|private`; or an unknown `kind:`                                                                                                             | set `"nx": { "tags": [...] }` as the message shows                                                    |
| `app-shell`                            | a shell is not named `shell-<zone>`, a zone has two shells, a remote folder starts with `shell-`; warning: a zone has remotes but no shell                                                                                                                         | rename, or `pnpm gen:shell <zone>`                                                                    |
| `app-port`                             | `mfe.port` is missing, outside the zone's app range (intranet 3100–3189, internet 3200–3289), or in the zone's dev-tools range (3190–3199 / 3290–3299: mock API, mock vendor; `tools/scripts/src/zones.js`)                                                        | pick a free port in the app range (and update the shell's `mfe-manifest.dev.json` entry)              |
| `app-port-duplicate`                   | two apps have the same `mfe.port`                                                                                                                                                                                                                                  | give one of them a free port                                                                          |
| `app-federation-name(-duplicate)`      | `mfe.federationName` is not a JS identifier, or two apps share one                                                                                                                                                                                                 | use `<zone>_<name>` (as generated)                                                                    |
| `app-name-duplicate`                   | two apps have the same package name                                                                                                                                                                                                                                | rename one                                                                                            |
| `app-dependency`                       | an app's `package.json` (any dependency field) lists another app                                                                                                                                                                                                   | remove it; shells load remotes at runtime, remotes never use remotes; shared code goes to `packages/` |
| `app-dependency-cross-zone`            | same, across zones                                                                                                                                                                                                                                                 | zones share only `packages/*`                                                                         |
| `app-import` / `app-import-cross-zone` | a file in an app's `src/` imports another app, by package name (`@org/intranet-x/...`), by relative path into another app, via `import()` or `require()`                                                                                                           | move the shared code to a package in `packages/`                                                      |
| `registry`                             | a shell's `remotes.json` is missing/invalid, lists a package that is not a remote of its zone, or its `access` / `federationName` disagrees with the remote's tags / `mfe`; warnings: a remote is not registered, or a registered remote has no dev manifest entry | fix `remotes.json` (or re-run `pnpm gen:remote` for a new remote)                                     |

## ESLint (in every project, `pnpm lint`)

`@org/eslint-config` adds two boundary rules:

- **`@nx/enforce-module-boundaries`** with the tags above:
  - `zone:intranet` must not depend on `zone:internet`, and vice versa
  - `type:remote` and `type:shell` may only depend on `type:package` (and `type:tool`), so a remote
    never imports a remote or a shell, and a shell never imports a remote
  - `type:package` may only depend on `type:package` (packages never depend on apps)
  - `type:tool` may depend on packages and tools
  - relative imports into another project fail with "Projects cannot be imported by a relative or
    absolute path"
- **`no-restricted-imports`** for app package names (`@org/intranet-*`, `@org/internet-*`,
  `@org/shell-*`). Nx maps a package import to a project only when that package declares
  `exports`/`main`, which apps do not, so app imports by name are blocked here. Do not give a
  shared package a name with these prefixes.

Fix: move the shared code into a package under `packages/` (tag `type:package`) and depend on it
with `workspace:*`.

When ESLint reports a boundary violation, Nx may also print `Error reading "tsconfig.base.json"`.
That is noise from the rule's fix suggestion (this repo has no `tsconfig.base.json`); the real
error follows.

## At runtime

Even if all of the above were bypassed, a remote built against a different tier-1 version fails
to load (Module Federation `strictVersion`) and the shell shows `RemoteFallback` for that route
only.
