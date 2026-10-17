# deploy/ (reference for DevOps)

Shared hosting templates for **every** app (shells and remotes): change caching, headers or CSP
once here. How the pipeline uses them: [docs/devops-handoff.md](../docs/devops-handoff.md).

| File                                     | What                                                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `Dockerfile`                             | multi-stage: installs and builds one app (`--build-arg APP=<package>`), serves `dist/` with non-root nginx on 8080 |
| `Dockerfile.dockerignore`                | build context filter (BuildKit picks it up next to the Dockerfile)                                                 |
| `nginx/default.conf.template`            | SPA fallback, caching (no-cache for entry files, immutable for hashed chunks), CORS allow-list, `/healthz`         |
| `nginx/security-headers.inc.template`    | CSP with placeholders (remotes, BFF, APIs, vendors, frames) + security headers                                     |
| `docker-entrypoint.d/40-mfe-manifest.sh` | writes `MFE_MANIFEST_JSON` to `/etc/mfe/mfe-manifest.json` at start-up (or mount the file there)                   |
| `mfe-manifest.example.json`              | example per-environment manifest of the intranet shell (validated by `pnpm -s validate-manifest`)                  |

```sh
docker build -f deploy/Dockerfile --build-arg APP=@org/shell-intranet -t shell-intranet .
docker run --rm -p 8080:8080 \
  -v "$PWD/deploy/mfe-manifest.example.json:/etc/mfe/mfe-manifest.json:ro" \
  -e CSP_REMOTE_ORIGINS="https://staff-directory.portal.example.sg" \
  shell-intranet
```

Environment variables and their defaults: top of `Dockerfile`; meaning: the devops handoff.

Verification status: the templates are checked by `tools/scripts/test/deploy.test.js` (every
`${VAR}` has a default, every location repeats the security headers, caching rules, CSP
placeholders). The Dockerfile's build stage commands were run outside Docker (filtered install +
build of a shell and a remote) and the CSP was exercised in a browser against production builds.
**No Docker image was built and `nginx -t` was not run** (neither is installed on the template
authors' machine): build the image once in your environment before relying on it.
