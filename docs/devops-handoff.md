# DevOps handoff (Azure DevOps)

What the frontend repo gives DevOps, and what the pipeline and the hosting need to do. Decision
D8: this repo contains **no pipeline code**; the YAML below is illustrative. Reference
`deploy/` templates (nginx, Dockerfile, example manifest) are maintained here.

## In one paragraph

One repository, one pipeline. Every app under `apps/<zone>/<name>` is a separate static web app
(a shell or a remote) with its own build output and its own deployment. On each PR/merge the
pipeline runs the gates once for the repo, asks `pnpm -s apps --affected` which apps changed
(a change in `packages/` affects every app that depends on it), and builds/deploys only those,
one matrix job per app, each into its own nginx image from the one shared `deploy/Dockerfile`.
The same image is promoted through every environment; what differs per environment is the
shell's `/mfe-manifest.json` (remote URLs, BFF URLs, vendor URLs) and the nginx environment
variables (CORS, CSP).

## Toolchain

| Tool     | Version / source                                                              | Notes                                                                                                     |
| -------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Node.js  | 24 LTS, from `.nvmrc`                                                         | `engines.node >=24`                                                                                       |
| pnpm     | exact version in `package.json` `packageManager` (12.x), via Corepack         | `corepack enable` once per agent/job; do not `npm i -g pnpm` (another version would rewrite the lockfile) |
| Chromium | via Playwright (`@playwright/test` in the catalog)                            | e2e only: `pnpm --filter <shell> exec playwright install --with-deps chromium`                            |
| Docker   | BuildKit (for `deploy/Dockerfile` cache mounts and `Dockerfile.dockerignore`) | image per app                                                                                             |

No other global tools. Everything else (Nx, Rspack, TypeScript, Jest, ESLint) is a workspace
dependency installed by `pnpm install --frozen-lockfile`.

## Gates (in this order)

| #   | Command                               | Fails when                                                                                               |
| --- | ------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1   | `pnpm install --frozen-lockfile`      | `pnpm-lock.yaml` does not match the `package.json` files                                                 |
| 2   | `pnpm check`                          | dependency tiers (catalog, exceptions), app metadata, cross-app imports ([guardrails.md](guardrails.md)) |
| 3   | `pnpm lint`                           | ESLint incl. module boundaries (runs `pnpm check` again; skip 2 if you like)                             |
| 4   | `pnpm typecheck`                      | TypeScript                                                                                               |
| 5   | `pnpm test`                           | Jest + node tests ([testing.md](testing.md))                                                             |
| 6   | `pnpm build` (or per app, see matrix) | Rspack production builds                                                                                 |
| 7   | `pnpm e2e:<zone>` (per affected zone) | Playwright e2e + axe WCAG 2.2 AA, light and dark ([testing.md](testing.md))                              |
| (8) | `pnpm format:check`                   | Prettier (optional gate; recommended)                                                                    |

Steps 2–5 can use `nx affected -t lint typecheck test --base=<sha>` instead of the `run-many`
root scripts to save time; Nx's cache (below) already skips unchanged projects.

## Affected apps → matrix

```sh
pnpm -s apps --json                                   # every app
pnpm -s apps --zone=internet --json                   # one zone
pnpm -s apps --affected --base=<sha> --json           # only apps affected since <sha>
pnpm -s apps --affected --base=<sha> --matrix         # Azure strategy.matrix object
```

Each app: `{ name, package, zone, type, access, kind, port, federationName, path, distDir }`, e.g.

```json
{
  "name": "staff-directory",
  "package": "@org/intranet-staff-directory",
  "zone": "intranet",
  "type": "remote",
  "access": "public",
  "kind": "react",
  "port": 3101,
  "federationName": "intranet_staff_directory",
  "path": "apps/intranet/staff-directory",
  "distDir": "apps/intranet/staff-directory/dist"
}
```

`--matrix` prints `{ "<federationName>": { "package": "...", "distDir": "...", ... } }` with
string values (`{}` when nothing is affected), usable as `strategy.matrix`.

How `--affected` decides:

- Nx (`nx show projects --affected`) with the package-based project graph: a change in an app
  affects that app; a change in `packages/ui` affects every app depending on `@org/ui`
  (in practice all of them); `tools/generators` affects no app. Without Nx it falls back to the
  git diff mapped onto the same `package.json` dependency graph.
- Changes to `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `nx.json`,
  `version-exceptions.json`, `.nvmrc` or anything in `deploy/` affect **every** app (versions,
  toolchain, nginx/Docker). Docs-only changes affect none.
- `--base`: on a PR, the merge base with the target branch (`git merge-base origin/main HEAD`);
  on `main`, the commit of the last successful deployment. `--head` defaults to the working tree
  (`HEAD` in CI). Checkout needs the history: `fetchDepth: 0`.
- Stdout is JSON only (pnpm echoes the command on stderr). `node tools/scripts/bin/list-apps.js
--json` is the same without pnpm.

e2e per zone: run `pnpm e2e:<zone>` when `pnpm -s apps --affected --base=<sha> --zone=<zone>
--json` is not `[]`.

## Caching

| Cache               | Path                                                                                                                                       | Key                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| pnpm store          | `pnpm store path` (set with `pnpm config set store-dir`)                                                                                   | `pnpm-lock.yaml` + OS                                      |
| Nx task cache       | `NX_CACHE_DIRECTORY` (set it, e.g. `$(Pipeline.Workspace)/.nx-cache`; Nx 23's default is `~/.nx/<workspace hash>/cache`, outside the repo) | lockfile + commit, restore from lockfile prefix            |
| Playwright browsers | `~/.cache/ms-playwright`                                                                                                                   | `@playwright/test` version (in `pnpm-workspace.yaml`) + OS |
| Docker layers       | BuildKit cache (`--cache-from`/registry cache)                                                                                             | the Dockerfile's first layers depend only on the lockfile  |

`nx.json` sets `neverConnectToCloud: true`: no Nx Cloud, the cache is local to the agent.

## Build outputs per app

| App type | `distDir` contents                                                                                                | Notes                                                |
| -------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| shell    | `index.html`, `main.<hash>.js`, chunks (`.js` + `.css`), `service-worker.js`, `manifest.webmanifest`, icons       | **no** `mfe-manifest.json` (written per environment) |
| remote   | `mf-manifest.json`, `remoteEntry.js`, `__federation_expose_App.<hash>.js/.css`, chunks, `index.html` (standalone) | shells load `mf-manifest.json` cross-origin (CORS)   |

Source maps (`*.map`) are emitted next to the files; the nginx template does not serve them
(404). Upload them to the error tracker in the pipeline if you use one.

They are **hidden, source-less maps** (`hidden-nosources-source-map`, set in
`@org/rspack-config`): mappings and source file names only, no `sourcesContent`, and the bundles
have no `sourceMappingURL` comment. Why: the original sources contain development-only branches
(e.g. `if (process.env.NODE_ENV !== 'production')` fallbacks to the mock vendor / mock API on
`http://localhost:…`) that the minifier removes from the bundles, but a classic `source-map`
would copy them verbatim into the `.map` files. An error tracker still resolves minified stack
traces to file and line; for source context, point it at the repository at the commit that was
built. Check a build with:

```sh
grep -l localhost apps/*/*/dist/*.map   # expect no output
```

An app that needs full maps (e.g. private symbol server) can pass
`productionSourceMap: 'hidden-source-map'` to its config factory; never publish those maps.

One image per app:

```sh
docker build -f deploy/Dockerfile --build-arg APP=@org/intranet-staff-directory \
  -t <registry>/intranet-staff-directory:<git sha> .
```

The Dockerfile installs only that app and its workspace dependencies
(`pnpm install --frozen-lockfile --filter "<app>..."`), runs its production build and copies
`dist/` into `nginxinc/nginx-unprivileged` (non-root, port 8080, `/healthz`). Pin both base
images by digest in your registry.

## One build, many environments: the manifest

The shell fetches `/mfe-manifest.json` at start-up. It is never built in; per environment it
lists where each remote lives, the BFF endpoints, vendor module URLs and free-form settings.
Example: [`deploy/mfe-manifest.example.json`](../deploy/mfe-manifest.example.json); schema:
`packages/mf-runtime/src/manifest/mfe-manifest.schema.json`; field reference:
[packages/mf-runtime/README.md](../packages/mf-runtime/README.md),
[auth-contract.md](auth-contract.md), [external-modules.md](external-modules.md).

- Keep one manifest per shell per environment (e.g. a config repo or secure files:
  `intranet/dev.json`, `intranet/prod.json`). It is public (served to browsers): no secrets.
- Validate before deploying:

  ```sh
  pnpm -s validate-manifest intranet/prod.json --zone=intranet
  ```

  Fails on schema errors, on a remote the shell routes to but the manifest lacks, on
  `"auth": { "mock": true }` and on `http://` entries; warns on unknown remotes.

- Provide it to the shell container either as a mounted file at
  `/etc/mfe/mfe-manifest.json` (ConfigMap / App Service file mount) or as the env var
  `MFE_MANIFEST_JSON` (the image writes it at start-up). nginx serves it with
  `Cache-Control: no-cache`.
- Remote URL, vendor version, BFF location changes = manifest change + shell container
  restart (or file update). No rebuild.
- `settings.apiBaseUrl`: the API base URL of that environment (absolute, or a same-origin path
  such as `/api` behind the BFF). The generated `mfe-manifest.dev.json` points it at the
  dev-only mock API (`tools/mock-api`, `http://localhost:3190/api` / `:3290`), which is never
  built or deployed.

## nginx and Docker: one template for every app

`deploy/nginx/default.conf.template` and `deploy/nginx/security-headers.inc.template` serve
every app; change caching, headers or CSP once there. The image renders them at start-up with
these environment variables (defaults in `deploy/Dockerfile`):

| Variable                 | Default                                                | Set to                                                                                             |
| ------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `NGINX_PORT`             | `8080`                                                 |                                                                                                    |
| `MFE_CORS_ORIGINS_REGEX` | `^$` (no CORS)                                         | **remotes**: the shell origins, e.g. `^https://(portal\|staff)\.example\.sg$`                      |
| `CSP_REMOTE_ORIGINS`     | empty                                                  | **shells**: origins of the remotes in the manifest (`https://staff-directory.portal.example.sg …`) |
| `CSP_BFF_ORIGINS`        | empty                                                  | BFF origin if not same-origin (recommended: same origin via the gateway)                           |
| `CSP_API_ORIGINS`        | empty                                                  | API origins called from the browser                                                                |
| `CSP_VENDOR_ORIGINS`     | empty                                                  | origins each vendor declared (bundle, chunks, APIs, fonts)                                         |
| `CSP_FRAME_SRC`          | `'none'`                                               | iframe origins (iframe-integrated vendors)                                                         |
| `CSP_EXTRA`              | empty                                                  | extra directives, e.g. `report-to csp`                                                             |
| `PERMISSIONS_POLICY`     | `camera=(), microphone=(), geolocation=(), payment=()` | relax per app if a feature needs it (`payment=(self "https://pay.vendor.example")`)                |
| `MFE_MANIFEST_JSON`      | empty                                                  | shells: the environment's manifest (or mount the file)                                             |

What the template does:

| Path                                                     | Caching                               | Other                          |
| -------------------------------------------------------- | ------------------------------------- | ------------------------------ |
| `/mfe-manifest.json` (from `/etc/mfe`)                   | `no-cache`                            |                                |
| `/mf-manifest.json`, `/mf-stats.json`, `/remoteEntry.js` | `no-cache`                            | CORS for allowed shell origins |
| `/service-worker.js`, `/manifest.webmanifest`            | `no-cache`                            |                                |
| `*.<8 hex>.js/css` (content hash, incl. extracted CSS)   | `public, max-age=31536000, immutable` | CORS                           |
| other static files (icons, fonts)                        | `public, max-age=3600`                | CORS                           |
| `*.map`                                                  | not served (404)                      |                                |
| everything else (`/`, deep links)                        | `index.html`, `no-cache`              | SPA fallback                   |
| `/healthz`                                               |                                       | 200 for probes                 |

Every response carries the security headers: CSP, `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy`, `Cross-Origin-Opener-Policy: same-origin`, HSTS. There is deliberately no
`Cross-Origin-Resource-Policy` (shells on other origins load remote chunks).

### CSP

The template's policy (shell responses are what matters):

```
default-src 'self'; script-src 'self' <remotes> <vendors>; style-src 'self' <remotes> <vendors>;
img-src 'self' data: <remotes> <vendors>; font-src 'self' <remotes> <vendors>;
connect-src 'self' <remotes> <bff> <apis> <vendors>; frame-src <frames|'none'>; worker-src 'self';
manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self' <bff>; frame-ancestors 'none';
upgrade-insecure-requests
```

- `script-src` + `connect-src` need every remote origin of the shell's manifest
  (`<script>` for `remoteEntry.js`/chunks, `fetch` for `mf-manifest.json`). Remotes on the
  shell's own origin (path-based routing) need nothing extra.
- `style-src` has **no `'unsafe-inline'`**: production builds ship extracted, content-hashed
  `.css` files, loaded as `<link rel="stylesheet">` from the app's own origin (the shell's from
  `'self'`, each remote's from its origin, so `style-src` needs the remote origins like
  `script-src`). Vendors style their shadow DOM with constructable stylesheets (not subject to
  `style-src`) or a stylesheet from their declared origin (`CSP_VENDOR_ORIGINS`). React `style`
  props are set through the CSSOM and are allowed. Blocked, by design: `<style>` elements and
  `style="…"` attributes in HTML. No nonces are needed. No `'unsafe-eval'` either (the manifest
  validator is precompiled).
- Remote CSS is requested without `crossorigin` (like the JS chunks), so it does not depend on
  CORS headers; the template still sends `Access-Control-Allow-Origin` for the allowed shells on
  hashed `.css` (needed only if a build turns on `crossOriginLoading`, e.g. for SRI).
- Verified in a browser against production builds of a shell, two remotes and an external
  adapter on four origins plus a vendor origin: no violations; removing the remote origins
  blocked them (the route showed its fallback). Re-verified without `'unsafe-inline'` after the
  switch to extracted CSS: zero violations, no `<style>` elements, everything styled, and a
  remote whose `.css` failed to load showed its fallback. Add `report-to`/`report-uri` via `CSP_EXTRA`
  and roll out with `Content-Security-Policy-Report-Only` first if you prefer.
- The frontend dev servers (`pnpm dev`) send the same rules with localhost origins, and dev
  builds extract CSS like production, so a change that would break this CSP already fails
  locally and in the e2e suite.

### Hosting topology

Either works; the build is the same:

- **Origin per app** (`staff-directory.portal.example.sg`): set `MFE_CORS_ORIGINS_REGEX` on
  remotes and `CSP_REMOTE_ORIGINS` on shells.
- **Path-based behind one gateway** (`portal.example.sg/remotes/staff-directory/`, prefix
  stripped by the gateway): no CORS and no CSP origins needed; the manifest uses root-relative
  entries (`/remotes/staff-directory/mf-manifest.json`). Remote chunks load relative to
  `remoteEntry.js` (`publicPath: 'auto'`). A remote's standalone `index.html` is then only
  reachable at its own root; it is a developer tool, not a user page.
- Route `/bff/*` (and APIs) through the shell's origin if possible: no CORS, `__Host-` cookies
  (see [auth-contract.md](auth-contract.md)).

### Rollouts and rollbacks

- Shell: users get the new `index.html` on the next navigation (`no-cache`). Keep the previous
  release's hashed files reachable for a while (blue/green, or copy `dist/` to the storage
  without deleting old hashes) so open tabs can still lazy-load their chunks.
- Remote: the shell picks up a new remote on the next page load (`mf-manifest.json`,
  `remoteEntry.js` are `no-cache`). Same rule for old chunks.
- Rollback = redeploy the previous image (or manifest). Tier-1 library upgrades
  (`react`, `react-router`, `@org/ui`, `@org/auth`) change the shared singleton version: deploy
  the shell and every remote of the zone together (strict version check; a mismatching remote
  shows its fallback rather than breaking the page).

## Branch policies and ownership

Azure Repos branch policies on `main`:

- Build validation: this pipeline is required; PRs need the gates green.
- Automatically included reviewers by path (code owners):

| Path                                                                             | Owner                                                        |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `apps/intranet/**`                                                               | intranet team(s), per app folder if teams own single remotes |
| `apps/internet/**`                                                               | internet team(s)                                             |
| `packages/**`, `tools/**`                                                        | platform / frontend core team                                |
| `pnpm-workspace.yaml`, `version-exceptions.json`, `nx.json`, root `package.json` | platform team (dependency tiers, exceptions)                 |
| `deploy/**`, `docs/devops-handoff.md`                                            | DevOps + platform team                                       |
| `packages/mf-runtime/src/external/**`, `packages/vendor-kit/**`                  | platform team + vendor owner (contract changes)              |

- Require linked work items and comment resolution as usual. Squash merge keeps `--base`
  detection simple.

## Vendor modules

- Vendors host their bundles (D3) at **versioned, immutable HTTPS URLs** with an **SRI hash**
  per release; their CDN allows our portal origins (CORS). Alternatively mirror the vendor's
  files into our storage: then their origin disappears from the CSP.
- Per environment, the shell manifest's `props.vendor` (`url`, `format`, `integrity`, `config`)
  points at the vendor release for that environment; the shell's `CSP_VENDOR_ORIGINS` (and
  `CSP_FRAME_SRC` for iframes) lists exactly the origins the vendor declared.
- Upgrading a vendor = manifest change (`url` + `integrity`), no rebuild; rollback likewise.
- The dev-only mock vendor (`tools/mock-vendor`) and mock API (`tools/mock-api`) are not apps
  and are never built or deployed; production bundles do not contain their URLs and the
  production source maps carry no sources (see "Build outputs per app").
- The vendor kit zip is built with `pnpm --filter @org/vendor-kit pack:kit`; publishing it to
  Azure Artifacts (Universal Package) is optional.

## Illustrative pipeline (not maintained here)

```yaml
# azure-pipelines.yml (illustration only; adapt pools, service connections, environments)
trigger: { branches: { include: [main] } }
pr: { branches: { include: [main] } }

variables:
  PNPM_STORE: $(Pipeline.Workspace)/.pnpm-store
  NX_CACHE_DIRECTORY: $(Pipeline.Workspace)/.nx-cache

stages:
  - stage: verify
    jobs:
      - job: gates
        pool: { vmImage: ubuntu-latest }
        steps:
          - checkout: self
            fetchDepth: 0
          - task: UseNode@1
            inputs: { version: '24.x' }
          - script: corepack enable && pnpm config set store-dir $(PNPM_STORE)
          - task: Cache@2
            inputs:
              key: 'pnpm | "$(Agent.OS)" | pnpm-lock.yaml'
              path: $(PNPM_STORE)
          - task: Cache@2
            inputs:
              key: 'nx | "$(Agent.OS)" | pnpm-lock.yaml | "$(Build.SourceVersion)"'
              restoreKeys: 'nx | "$(Agent.OS)" | pnpm-lock.yaml'
              path: $(NX_CACHE_DIRECTORY)
          - script: pnpm install --frozen-lockfile
          - script: pnpm lint && pnpm typecheck && pnpm test && pnpm format:check
          - script: |
              BASE=$(git merge-base origin/main HEAD)
              echo "##vso[task.setvariable variable=matrix;isOutput=true]$(pnpm -s apps --affected --base=$BASE --matrix)"
            name: affected

      # one job per affected app (documented pattern: matrix from a previous job's output
      # variable in the same stage)
      - job: app
        dependsOn: gates
        condition: and(succeeded(), ne(dependencies.gates.outputs['affected.matrix'], '{}'))
        strategy:
          matrix: $[ dependencies.gates.outputs['affected.matrix'] ]
        steps:
          - script: >
              docker build -f deploy/Dockerfile --build-arg APP=$(package)
              -t $(registry)/$(name):$(Build.SourceVersion) .
          # push the image; deploy per environment with its manifest + nginx env vars

      - job: e2e
        dependsOn: gates
        strategy:
          matrix: { intranet: { zone: intranet }, internet: { zone: internet } }
        steps:
          # (same checkout/Node/pnpm/cache setup as in "gates")
          - script: |
              BASE=$(git merge-base origin/main HEAD)
              if [ "$(pnpm -s apps --affected --base=$BASE --zone=$(zone) --json)" = "[]" ]; then exit 0; fi
              pnpm --filter @org/shell-$(zone) exec playwright install --with-deps chromium
              CI=true pnpm e2e:$(zone)
          - task: PublishTestResults@2
            condition: always()
            inputs:
              {
                testResultsFiles: 'apps/$(zone)/shell-$(zone)/test-results/junit.xml',
              }
```

## Checklist for DevOps

- [ ] Agents: Node 24, `corepack enable`, BuildKit; checkout with full history
- [ ] Caches: pnpm store, Nx cache (`NX_CACHE_DIRECTORY`), Playwright browsers
- [ ] Gates in order; `pnpm e2e:<zone>` for affected zones; JUnit + HTML report published
- [ ] Matrix from `pnpm -s apps --affected --base=<sha> --matrix`; one image per app from
      `deploy/Dockerfile` (`--build-arg APP=<package>`); images promoted unchanged across
      environments
- [ ] Per environment and shell: `mfe-manifest.json` validated with
      `pnpm -s validate-manifest <file> --zone=<zone>`, mounted at `/etc/mfe/mfe-manifest.json`
      (or `MFE_MANIFEST_JSON`)
- [ ] nginx env vars per app/environment: `MFE_CORS_ORIGINS_REGEX` (remotes), `CSP_*` (shells)
- [ ] TLS + HSTS at the gateway; `/bff/*` routed through the shell origin if possible
- [ ] Old hashed assets kept during rollouts; tier-1 upgrades deployed zone-wide together
- [ ] Branch policies: build validation + path-based reviewers
- [ ] Vendor origins in the CSP; vendor URLs + SRI in the manifest; mock vendor never deployed
