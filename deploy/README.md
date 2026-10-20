# deploy/ (reference for DevOps)

Shared hosting templates for **every** app (shells and remotes): change caching, headers or CSP
once here. How the pipeline uses them: [docs/devops-handoff.md](../docs/devops-handoff.md).

| File                                     | What                                                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `Dockerfile`                             | multi-stage: installs and builds one app (`--build-arg APP=<package>`), serves `dist/` with non-root nginx on 8080 |
| `Dockerfile.dockerignore`                | build context filter (BuildKit picks it up next to the Dockerfile)                                                 |
| `nginx/default.conf.template`            | SPA fallback, caching (no-cache for entry files, immutable for hashed chunks), CORS allow-list, `/healthz`         |
| `nginx/security-headers.inc.template`    | CSP with placeholders (remotes, BFF, APIs, vendors, frames; no `'unsafe-inline'`) + security headers               |
| `docker-entrypoint.d/40-mfe-manifest.sh` | writes `MFE_MANIFEST_JSON` to `/etc/mfe/mfe-manifest.json` at start-up (or mount the file there)                   |
| `mfe-manifest.example.json`              | example per-environment manifest of the intranet shell (validated by `pnpm -s validate-manifest`)                  |
| `nginx/zone-router.example.conf`         | example reverse proxy for several shells on one domain (`/citizen`, `/business`, `/` → default shell)              |

```sh
docker build -f deploy/Dockerfile --build-arg APP=@org/shell-intranet -t shell-intranet .
docker run --rm -p 8080:8080 \
  -v "$PWD/deploy/mfe-manifest.example.json:/etc/mfe/mfe-manifest.json:ro" \
  -e CSP_REMOTE_ORIGINS="https://staff-directory.portal.example.sg" \
  shell-intranet
```

Environment variables and their defaults: top of `Dockerfile`; meaning: the devops handoff.

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
- each container has its own environment: its own `mfe-manifest.json` (remotes, `auth` = its own
  BFF, settings) and its own CSP variables, so the business shell only allows the origins it uses;
- sessions: each shell's BFF scopes its session cookie to the shell (`Path=/citizen` /
  `Path=/business`, or distinct cookie names) and the shell's `loginUrl` / `sessionUrl` point at
  it, so a Singpass session of `/citizen` is never sent to `/business` (Corppass) and the other way
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
authors' machine): build the image once in your environment before relying on it.
