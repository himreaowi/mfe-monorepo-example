# mfe-monorepo-template

Template monorepo for React microfrontends: pnpm workspaces + Nx (package-based) + Rspack +
Module Federation 2 (`@module-federation/enhanced`).

**Status: phase A1 (workspace skeleton).** There are no apps or runtime packages yet.

## What's here

| Path                       | Contents                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------ |
| `apps/`                    | Empty. Generators will add `apps/<zone>/<name>`                                      |
| `packages/tsconfig`        | `@org/tsconfig`: `base.json`, `react-app.json`, `library.json`                       |
| `packages/eslint-config`   | `@org/eslint-config`: shared flat config (TS, React hooks, Prettier)                 |
| `packages/prettier-config` | `@org/prettier-config`: shared Prettier options                                      |
| `tools/`                   | Empty (generators and scripts come later)                                            |
| `docs/toolchain.md`        | Pinned versions, the A0 spike evidence, gotchas                                      |
| `pnpm-workspace.yaml`      | Workspace globs, the default catalog (one version per core library), isolated linker |
| `version-exceptions.json`  | Justified opt-outs from the catalog (empty)                                          |
| `nx.json`                  | Task caching and defaults for `build`, `lint`, `test`, `typecheck`                   |

## Getting started

```sh
nvm use            # Node 24
corepack enable    # provides the pnpm version pinned in package.json
pnpm install
pnpm lint
pnpm test
pnpm typecheck
pnpm format:check
```

Each package has its own `node_modules` (pnpm isolated layout). Add a dependency to the package
that uses it (`pnpm --filter <pkg> add <dep>`). Packages in the catalog are written as `catalog:`.
See `docs/toolchain.md`.
