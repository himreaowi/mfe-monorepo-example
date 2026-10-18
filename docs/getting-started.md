# Getting started

From a fresh clone to a running zone with tests. Commands run from the repository root unless
noted. Takes about ten minutes, most of it downloads.

## 1. Prerequisites

- **Node.js 24** (the version is in `.nvmrc`). With nvm: `nvm install 24` once.
- **Corepack** (ships with Node 24) provides the exact pnpm version from `package.json`
  (`packageManager`). Do not install pnpm globally with npm.
- Git. macOS, Linux or WSL2.

## 2. Clone and install

```sh
git clone <repo-url> my-portal
cd my-portal
nvm use               # Node 24 from .nvmrc
corepack enable       # once per Node installation: puts the pinned pnpm on the PATH
pnpm install
```

Check that the empty template is green:

```sh
pnpm check            # guardrails (dependency tiers, app metadata)
pnpm lint
pnpm typecheck
pnpm test
```

`apps/` is empty: the template ships shared packages, tools and docs only.

## 3. Create apps

Each zone (`intranet`, `internet`) has one shell and any number of remotes. Create the shell
first:

```sh
pnpm gen:shell intranet
pnpm gen:remote intranet staff-directory                # public remote
pnpm gen:remote intranet leave-requests --private       # sign-in required
pnpm gen:remote intranet it-helpdesk --external         # adapter for a vendor module
pnpm install
```

Each remote gets the next free port (shell 3100, remotes 3101, 3102, …), a route in the shell
(`/staff-directory/*`) and an entry in the shell's dev manifest. Details:
[adding-an-app.md](adding-an-app.md).

## 4. Run a zone

```sh
pnpm dev:intranet
```

Open http://localhost:3100. The shell loads every remote from its own dev server at runtime.
"Sign in" uses the development mock (no backend needed). The remotes' demo feature loads data
from the zone's **mock API** (`tools/mock-api`, http://localhost:3190/api, started
automatically; its URL is `settings.apiBaseUrl` in the shell's `mfe-manifest.dev.json`).
`it-helpdesk` mounts the mock vendor module (started automatically on port 3191). Stop with
Ctrl+C.

The other zone can run at the same time (`pnpm dev:internet`: shell on 3200, mock API 3290,
mock vendor 3291): every zone has its own port range, tools included (3190–3199 / 3290–3299).

One remote on its own (standalone mode, mock host props):

```sh
pnpm --filter @org/intranet-staff-directory dev        # http://localhost:3101
```

## 5. Test

```sh
pnpm test                                                        # unit tests, every project
pnpm --filter @org/shell-intranet exec playwright install chromium   # once per machine
pnpm e2e:intranet                                                # zone e2e + axe (light + dark)
```

`pnpm e2e:intranet` starts `pnpm dev:intranet` itself (or reuses it if it is already running),
tests every remote in the shell and standalone, on desktop and 375 px, and stops the servers
afterwards. `pnpm e2e` runs every zone, one after the other. See [testing.md](testing.md).

## 6. Build

```sh
pnpm build                                   # every app → apps/<zone>/<name>/dist
pnpm -s apps                                 # what was built, with ports
```

Look at a production build locally (the shell needs a manifest; the dev one works):

```sh
pnpm --filter @org/intranet-staff-directory preview &
pnpm --filter @org/shell-intranet preview --manifest mfe-manifest.dev.json
```

Production uses the per-environment manifest and nginx from `deploy/`
([devops-handoff.md](devops-handoff.md)). Note: the dev manifest's mock sign-in is disabled in
production builds, so private remotes show "Sign-in unavailable" in this preview.

## 7. Before you push

```sh
pnpm check && pnpm lint && pnpm typecheck && pnpm test && pnpm format:check
pnpm build && pnpm e2e
```

CI runs the same gates ([devops-handoff.md](devops-handoff.md)).

## Daily commands

| Command                                                                            | What                                                                |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `pnpm dev:<zone>`                                                                  | shell + every remote of the zone                                    |
| `pnpm --filter <package> dev`                                                      | one app (`pnpm -s apps` lists package names)                        |
| `pnpm gen:shell <zone>` / `pnpm gen:remote <zone> <name> [--private] [--external]` | new apps                                                            |
| `pnpm --filter <package> add <dep>`                                                | add a dependency ([adding-dependencies.md](adding-dependencies.md)) |
| `pnpm lint` / `typecheck` / `test` / `build`                                       | all projects (Nx, cached)                                           |
| `pnpm e2e` / `pnpm e2e:<zone>`                                                     | zone e2e suites                                                     |
| `pnpm -s apps [--zone=<zone>] [--affected --base=<sha>] [--json]`                  | list apps (CI matrix)                                               |
| `pnpm format`                                                                      | Prettier                                                            |

## Next

- [architecture.md](architecture.md): how shells, remotes, manifest, auth and vendors fit
- [coding-conventions.md](coding-conventions.md) and [ui-context.md](ui-context.md) before writing code
- [project-overview.md](project-overview.md): fill in your product
- `AGENTS.md` if you work with AI coding agents

## Troubleshooting

| Symptom                                                        | Fix                                                                                                                  |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `pnpm: command not found` or a different pnpm version          | `corepack enable`; a `packageManager` field in a parent folder (e.g. `~/package.json`) can confuse Corepack          |
| `ERR_PNPM_IGNORED_BUILDS` after adding a dependency            | the package has an install script: decide in `allowBuilds` (`pnpm-workspace.yaml`), see [toolchain.md](toolchain.md) |
| a remote shows "unavailable" in the shell                      | is its dev server running? `pnpm dev:<zone>` starts all; check the shell's `mfe-manifest.dev.json` port              |
| changed `rspack.config.js` or a shared config, nothing happens | restart the dev server (Rspack does not reload config files)                                                         |
| e2e: "Executable doesn't exist"                                | `pnpm --filter @org/shell-<zone> exec playwright install chromium`                                                   |
| e2e: "Not responding after 180 s"                              | a port is taken by a stale server (`lsof -i :3101`) or a remote fails to compile (`pnpm dev:<zone>` shows why)       |
| `pnpm check` fails                                             | every message names the fix; [guardrails.md](guardrails.md)                                                          |
