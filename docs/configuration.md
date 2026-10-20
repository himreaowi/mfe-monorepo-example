# Configuration: variables, `.env` files and the same-origin proxy

One build runs in every environment. What differs per environment is configuration, and it is
split by **who may see it**:

| Where it lives                                                                 | Seen by the browser? | Examples                                                                                   |
| ------------------------------------------------------------------------------ | -------------------- | ------------------------------------------------------------------------------------------ |
| **Server-side** variables of the shell container (`API_UPSTREAM`, ...)         | no                   | the API host, the sign-in BFF host, internal service names, a TLS CA, CSP/CORS allow-lists |
| **`mfe-manifest.json`** generated from them at start (served to every visitor) | yes, public          | remote entry URLs, relative `/citizen/api`, relative `/citizen/auth/...`, `environment`    |
| **Code / build**                                                               | yes                  | nothing environment-specific (no `.env` read at build time, no `DefinePlugin` URLs)        |

Rule of thumb: **if you would not print it on a poster, it is server-side**. The browser only ever
calls its own origin; nginx forwards to the real backends.

## Same-origin `/api` and `/auth`

Every shell serves two proxied paths below its base path (`package.json` `mfe.basePath`, `/` by
default). Per shell, not per domain, so two shells on one domain can use different backends:

| Browser calls                                                              | Forwarded to                       | For                               |
| -------------------------------------------------------------------------- | ---------------------------------- | --------------------------------- |
| `<base>/api/...` (`/citizen/api/leave`, `/api/...` at `/`)                 | `API_UPSTREAM` + rest of the path  | the zone's API (`useApiClient()`) |
| `<base>/auth/session`, `/login`, `/logout` (only if the shell has sign-in) | `AUTH_UPSTREAM` + rest of the path | the sign-in BFF (`@org/auth`)     |

`API_UPSTREAM=https://api.uat.example.sg/v1` turns `GET /citizen/api/leave?x=1` into
`GET https://api.uat.example.sg/v1/leave?x=1`. The prefix is stripped, the rest is appended.

- The manifest contains relative URLs only: `settings.apiBaseUrl` is `<base>/api`, the `auth` URLs
  are `<base>/auth/session|login|logout`. Remotes keep using `useApiClient()`; its base URL is
  just relative now. `credentials: 'include'` still applies (same-origin cookies).
- No CORS, no `Access-Control-*`, and the CSP `connect-src` is `'self'` plus remotes and vendors.
  The former `CSP_API_ORIGINS` and `CSP_BFF_ORIGINS` variables are gone.
- nginx passes cookies, `Authorization` and the CSRF header unchanged and returns `Set-Cookie`
  unchanged. It sets `Host` (the upstream's), `X-Forwarded-For`, `X-Forwarded-Proto` (the
  gateway's value if it sent one), `X-Forwarded-Host` (the public host) and
  `X-Forwarded-Prefix` (`<base>/api` or `<base>/auth`; a BFF builds its callback and redirect URLs
  from it). Timeouts: connect 5 s, send/read 60 s. Request bodies up to 10 MB. Responses are never
  cached (`proxy_cache off`, `Cache-Control: no-store`). `https://` upstreams are verified against
  the system CA bundle (`proxy_ssl_verify on`, SNI on); mount your internal CA into it if needed.
- The proxy locations are `location ^~`, so they win over the static-file rules: `/citizen/api/x.json`
  is an API call. The paths `<base>/api` and `<base>/auth` are therefore reserved: no route of a
  shell or remote may use them.
- nginx resolves the upstream host name when it starts; restart the container if an IP changes.
- BFF cookies: scope the session cookie to the shell (`Path=<base>`, or `Path=/` for a single
  shell on the domain, or distinct names, [auth-contract.md](auth-contract.md)).

### In local development

`pnpm dev:<zone>` starts the zone's dev proxy (:3100 intranet, :3200 internet), which does for
`<base>/api` and `<base>/auth` what nginx does in production (same prefix stripping, cookies,
`X-Forwarded-*`, `no-store`), so dev behaves like production and the pages only ever talk to the
proxy origin. `API_UPSTREAM` defaults to the zone's mock API (`http://localhost:3190/api` /
`:3290`); `AUTH_UPSTREAM` has no default (dev uses the mock sign-in). The dev CSP still allows
localhost origins, because the shells load the remotes' dev servers and their HMR sockets, but
API calls no longer need it.

**Point dev at a real UAT API**: create `apps/<zone>/shell-<name>/.env` (or the zone's `.env`):

```sh
API_UPSTREAM=https://api.uat.example.sg/v1
AUTH_UPSTREAM=https://bff.uat.example.sg      # optional; also set "auth" to the BFF URLs
```

then restart `pnpm dev:<zone>`. The proxy talks to `https://` upstreams with the upstream's own
`Host`; cookies come back as the API set them, so use an API that accepts a `localhost` caller
(its session cookie must not require a `Domain`/`Secure` that a plain-http localhost page cannot
use). Do not commit the `.env`.

## Variables

All server-side, all optional in dev. Names are shared by the dev proxy and the container; they
are listed, with comments, in each zone's `.env.example`.

| Variable                                                                                       | Where       | Meaning                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `API_UPSTREAM`                                                                                 | dev, deploy | URL `<base>/api` is forwarded to (`https://host[:port][/path]`). Dev default: the zone's mock API. Deploy: without it `<base>/api` answers 503 and no `apiBaseUrl` is published                     |
| `AUTH_UPSTREAM`                                                                                | dev, deploy | URL `<base>/auth` is forwarded to (the BFF). **Required** for a shell with sign-in (`mfe.devManifest.auth`)                                                                                         |
| `REMOTE_<FEDERATION_NAME>_URL`                                                                 | deploy      | Entry URL of a remote (`https://host/mf-manifest.json`, or a path). Federation name upper-cased: `REMOTE_INTRANET_STAFF_DIRECTORY_URL`. **Required** for every remote in the shell's `remotes.json` |
| `REMOTE_<FEDERATION_NAME>_PROPS`                                                               | deploy      | Optional: that remote's extra props as one line of JSON (`{"vendor":{"url":"https://..."}}`)                                                                                                        |
| `MFE_ENVIRONMENT`                                                                              | deploy      | Optional `settings.environment` (`uat`, `production`)                                                                                                                                               |
| `MFE_MANIFEST_JSON` / mounted file                                                             | deploy      | A complete manifest, used as is instead of generating one (see below)                                                                                                                               |
| `NGINX_PORT`                                                                                   | deploy      | default `8080`                                                                                                                                                                                      |
| `MFE_CORS_ORIGINS_REGEX`                                                                       | deploy      | remotes: the shell origins allowed to load their files                                                                                                                                              |
| `CSP_REMOTE_ORIGINS`, `CSP_VENDOR_ORIGINS`, `CSP_FRAME_SRC`, `CSP_EXTRA`, `PERMISSIONS_POLICY` | deploy      | security headers ([devops-handoff.md](devops-handoff.md#csp))                                                                                                                                       |

Naming convention: the federation name is the remote's `mfe.federationName` (`remotes.json`),
upper-cased. Names that differ only by letter case are rejected by `pnpm check`.

### The manifest is generated at container start

For a shell image, `deploy/docker-entrypoint.d/40-mfe-manifest.sh` writes
`/etc/mfe/mfe-manifest.json` from the variables above plus what the image knows about its shell
(base path, registered remotes, sign-in; `deploy/write-shell-env.mjs` records them at build time):

```json
{
  "remotes": {
    "internet_services": {
      "entry": "https://services.example.sg/mf-manifest.json"
    }
  },
  "auth": {
    "sessionUrl": "/citizen/auth/session",
    "loginUrl": "/citizen/auth/login",
    "logoutUrl": "/citizen/auth/logout"
  },
  "settings": { "apiBaseUrl": "/citizen/api", "environment": "uat" }
}
```

It **fails fast** (container exits 1 with the list of everything wrong) on: a registered remote
without its `REMOTE_..._URL`, an entry that is not an https URL or `/path` ending in `.json`/`.js`
(http only for localhost), `AUTH_UPSTREAM` missing for a shell with sign-in, an upstream that is
not `http(s)://host[:port][/path]`, malformed `..._PROPS`. The checks are POSIX `sh` (the nginx
image has no Node); the full schema check is `pnpm -s validate-manifest`, which CI can run on the
generated file (the unit tests do), and which warns about absolute API/sign-in URLs.

A complete manifest still works as before and wins: `MFE_MANIFEST_JSON`, or a file mounted
read-only at `/etc/mfe/mfe-manifest.json`. Then the variables are not used for the manifest, but
`API_UPSTREAM` / `AUTH_UPSTREAM`, when set, still create the proxy locations (migrate by making
the manifest URLs relative). Remote images ignore all of this and get no manifest.

## `.env` files

```
apps/<zone>/.env                  shared by the zone's shells        (git-ignored)
apps/<zone>/shell-<name>/.env     overrides for one shell            (git-ignored)
apps/<zone>/.env.example          committed: every variable, with comments
apps/<zone>/shell-<name>/.env.example   committed, only when a shell needs its own (a second
                                        shell in the zone gets one from `pnpm gen:shell`)
```

Precedence, strongest first: **real environment** > **shell `.env`** > **zone `.env`** > defaults
(the mock API for `API_UPSTREAM`). Files are parsed with Node's built-in `util.parseEnv`
(`tools/scripts/src/env.js`); there is no dotenv dependency and nothing is written into
`process.env`. The dev proxy reads them when `pnpm dev:<zone>` starts.

```sh
cp apps/internet/.env.example apps/internet/.env         # then uncomment and edit
docker run --env-file apps/internet/.env ...             # the same file works for the container
```

For deployments the `.env` is only a convenience for local `docker run`; real values come from
the environment's pipeline (below), never from git.

`pnpm check` (`check-env`) fails when: a real `.env` / `.env.*` (anything but `.env.example`) is
tracked by git; `.gitignore` does not ignore them; a zone with shells has no `.env.example`; that
file does not document every variable the tooling reads (and a `REMOTE_..._URL` for each
registered remote); or a shell's `.env.example` lists an unknown variable. `pnpm gen:shell` and
`pnpm gen:remote` keep the `.env.example` files up to date.

## Per-environment values in Azure DevOps

Keep one **variable group per zone/shell and environment**, named for what it configures, e.g.
`internet-citizen-uat`, `internet-business-uat`, `intranet-uat`, `intranet-prod`. Each holds exactly
the variables of that shell's `.env.example` that differ from the image defaults
(`API_UPSTREAM`, `AUTH_UPSTREAM`, the `REMOTE_..._URL`s, `MFE_ENVIRONMENT`, CSP/CORS values). The
deployment stage of that environment links the group and passes the variables to the container
(`env:` of the container app / App Service settings / `docker run --env-file`).

- Secret values (a BFF client secret, API keys) do not belong in the frontend at all: they live in
  the BFF/API. If an upstream needs a token header, add it in the gateway, not in this repo.
- Mark anything sensitive as secret in the variable group (or link it to Key Vault). Upstream URLs
  are not secrets but are internal topology; keep them out of git and logs.
- Secret scanning: enable Azure DevOps Advanced Security / a pre-commit scanner on the repo so a
  committed `.env` or token is caught; `pnpm check` already blocks tracked `.env` files, and
  `.env.example` must only hold placeholders (`https://api.uat.example.sg`, never real hosts).
- Promote the same image through environments; only the variable group changes.

## Adding a variable

1. Read it in the dev proxy (`tools/scripts/src/zone-proxy.js`) or the entrypoint script.
2. Add it to `ENV_VARIABLES` in `tools/scripts/src/env.js` and to the Dockerfile `ENV` block
   (a unit test compares the two) and to `renderZoneEnvExample`.
3. Document it in every zone's `.env.example` (`pnpm check` tells you where it is missing) and in
   the table above.
