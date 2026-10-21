# deploy/ (reference for DevOps)

Shared hosting templates for **every** app (shells and remotes): change caching, headers or CSP
once here. How the pipeline uses them: [docs/devops-handoff.md](../docs/devops-handoff.md).

| File                                     | What                                                                                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `Dockerfile`                             | multi-stage: installs and builds one app (`--build-arg APP=<package>`), serves `dist/` with non-root nginx on 8080                   |
| `Dockerfile.dockerignore`                | build context filter (BuildKit picks it up next to the Dockerfile)                                                                   |
| `nginx/default.conf.template`            | SPA fallback, caching (no-cache for entry files, immutable for hashed chunks), CORS allow-list, `/healthz`                           |
| `nginx/security-headers.inc.template`    | CSP with placeholders (remotes, vendors, frames; API and BFF are same-origin; no `'unsafe-inline'`) + security headers               |
| `nginx/proxy-common.inc.template`        | settings of the same-origin `<base>/api` and `<base>/auth` proxy (headers, timeouts, no caching)                                     |
| `docker-entrypoint.d/40-mfe-manifest.sh` | generates `/etc/mfe/mfe-manifest.json` and the proxy locations from `API_UPSTREAM`, `AUTH_UPSTREAM`, `REMOTE_<NAME>_URL`; fails fast |
| `write-shell-env.mjs`                    | build step: records the shell's base path, remotes and sign-in for the entrypoint script                                             |
| `mfe-manifest.example.json`              | example per-environment manifest of the intranet shell (validated by `pnpm -s validate-manifest`)                                    |
| `nginx/zone-router.example.conf`         | example reverse proxy for several shells on one domain (`/citizen`, `/business`, `/` → default shell)                                |

```sh
docker build -f deploy/Dockerfile --build-arg APP=@org/shell-staff -t shell-staff .
docker run --rm -p 8080:8080 --env-file apps/intranet/.env shell-staff
```

`apps/intranet/.env` (zone level; a shell's own overrides: `apps/intranet/<shell>/.env`; copy of the committed `.env.example`, git-ignored) holds, for example:

```sh
API_UPSTREAM=https://api.uat.example.sg/v1
AUTH_UPSTREAM=https://bff.uat.example.sg
REMOTE_INTRANET_STAFF_DIRECTORY_URL=https://staff-directory.portal.example.sg/mf-manifest.json
REMOTE_INTRANET_LEAVE_REQUESTS_URL=https://leave-requests.portal.example.sg/mf-manifest.json
CSP_REMOTE_ORIGINS=https://staff-directory.portal.example.sg https://leave-requests.portal.example.sg
```

The container generates the manifest (relative `/api`, `/auth/...` URLs plus the remotes' entry
URLs) and proxies `/api/...` to `API_UPSTREAM` and `/auth/...` to `AUTH_UPSTREAM` (for a shell with
base path `/citizen`: `/citizen/api`, `/citizen/auth`); the browser never sees the upstream hosts.
A complete manifest can still be mounted instead
(`-v "$PWD/deploy/mfe-manifest.example.json:/etc/mfe/mfe-manifest.json:ro"`) or passed as
`MFE_MANIFEST_JSON`. Variables: [docs/configuration.md](../docs/configuration.md); defaults: top of
the `Dockerfile`; the rest of the meaning: the devops handoff. In pipelines use one Azure DevOps
variable group per zone/shell and environment (`internet-citizen-uat`, ...) instead of a file.

## Several shells on one domain

A zone can have several shells, each with its own base path (`package.json` `mfe.basePath`),
layout, sign-in and manifest, e.g. `portal.example.sg/citizen` and `portal.example.sg/business`.
**Recommended: one container per shell** (the same Dockerfile, `--build-arg APP=@org/shell-citizen`)
behind the domain's reverse proxy / ingress:

- the image serves a shell with a base path below it: `dist/` lands in `html/citizen/`, the
  manifest is answered at `/citizen/mfe-manifest.json` (still mounted at
  `/etc/mfe/mfe-manifest.json`), deep links fall back to `/citizen/index.html` and the container's
  `/` redirects to `/citizen/`; the service worker is scoped to `/citizen/`;
- the reverse proxy routes each base path to its container **without rewriting the path** and
  redirects `/` to the default shell: [`nginx/zone-router.example.conf`](nginx/zone-router.example.conf);
- each container has its own environment (an `--env-file` / variable group per shell): its own
  `API_UPSTREAM` and `AUTH_UPSTREAM` (so `/citizen/api` and `/business/api` can reach different
  backends, and `/citizen/auth` / `/business/auth` their own BFF), its remotes' `REMOTE_..._URL`
  and its own CSP variables, so the business shell only allows the origins it uses;
- sessions: each shell's BFF scopes its session cookie to the shell (`Path=/citizen` /
  `Path=/business`, or distinct cookie names) and the shell's `loginUrl` / `sessionUrl` point at
  its `<base>/auth/...`, so a Singpass session of `/citizen` is never sent to `/business` (Corppass) and the other way
  round;
- remotes listed by both shells (e.g. `announcements`) are deployed once; add both shells' origin
  (here the same domain) to the remote's `MFE_CORS_ORIGINS_REGEX`.

One nginx serving several shells' files is possible (copy each `dist/` to its base-path folder),
but it couples the shells' releases and CSPs; prefer one container per shell.

```sh
docker build -f deploy/Dockerfile --build-arg APP=@org/shell-citizen -t shell-citizen .
docker build -f deploy/Dockerfile --build-arg APP=@org/shell-business -t shell-business .
```

Verification status: the templates are checked by `tools/scripts/test/deploy.test.js` (every
`${VAR}` has a default, every location repeats the security headers, caching rules, CSP
placeholders, no `'unsafe-inline'`/`'unsafe-eval'`). The Dockerfile's build stage commands were
run outside Docker (filtered install + build of a shell and a remote) and the CSP was exercised
in a browser against production builds (zero violations without `style-src 'unsafe-inline'`:
production CSS is extracted into hashed `.css` files, which the immutable-cache rule and the
CORS allow-list already cover).
The base-path handling (html/<base path>/, `mfe-base-path.inc`, the zone router example) is
covered by the same static tests and by `pnpm dev:<zone>`'s dev proxy, which routes the same way.
**No Docker image was built and `nginx -t` was not run** (neither is installed on the template
authors' machine): build the image once in your environment before relying on it. The entrypoint script is run with
`sh` in the unit tests (generated manifest validated with the real validator, generated proxy
locations asserted, failure messages) and the nginx templates are asserted statically; the
combined config has not been loaded by nginx, so run `nginx -t` in the built image once.
