# Auth contract (frontend ↔ BFF)

Decision D6: auth is **provider-agnostic** and uses the **backend session (BFF) pattern**. The
browser never receives, stores or sends access, ID or refresh tokens. A backend-for-frontend
(BFF) runs the sign-in flow with the identity provider, keeps the tokens server-side and gives
the browser an HttpOnly session cookie. The frontend (`@org/auth`) only asks the BFF who is
signed in, sends the browser to the BFF to sign in, and asks the BFF to sign out.

> **Singpass (internet zone) and the intranet SSO are backend-owned.** Which provider, OIDC
> client registration, `state`/`nonce`/PKCE, token exchange and validation, NRIC/UINFIN
> handling, MFA levels, session store, idle/absolute timeouts and IdP logout are decided and
> implemented by the backend team behind the endpoints below. The frontend does not change
> when the provider changes.

```
Browser (shell + remotes)                     BFF (backend-owned)                 IdP
  GET  sessionUrl  (cookie) ───────────────▶  200 { user, csrfToken, expiresAt } | 401
  navigate loginUrl?returnTo=… ───────────▶  302 ─────────────────────────────▶  Singpass / SSO
                                             ◀── callback (code) ───────────────
  ◀── 302 returnTo  + Set-Cookie: session (HttpOnly; Secure; SameSite)
  POST logoutUrl  (cookie + X-CSRF-Token) ─▶  204 | 200 { redirectUrl }  (IdP end-session)
  API calls (cookie [+ X-CSRF-Token]) ─────▶  BFF / API checks the session on every request
```

## Configuration (per environment, no rebuild)

The shell reads the `auth` section of `/mfe-manifest.json` (written per environment by DevOps,
validated by `mfe-manifest.schema.json`):

```json
{
  "auth": {
    "sessionUrl": "/citizen/auth/session",
    "loginUrl": "/citizen/auth/login",
    "logoutUrl": "/citizen/auth/logout",
    "csrfHeaderName": "X-CSRF-Token",
    "returnToParam": "returnTo",
    "timeoutMs": 10000
  }
}
```

| Key                                   | Required | Meaning                                                                             |
| ------------------------------------- | -------- | ----------------------------------------------------------------------------------- |
| `sessionUrl`, `loginUrl`, `logoutUrl` | yes      | Absolute `https://` URL or root-relative path (recommended: same origin, see CORS)  |
| `csrfHeaderName`                      | no       | Header carrying the CSRF token. Default `X-CSRF-Token`                              |
| `returnToParam`                       | no       | Query parameter name on `loginUrl`. Default `returnTo`                              |
| `timeoutMs`                           | no       | Session request timeout (1000–60000). Default 10000                                 |
| `mock`                                | no       | `true` = in-browser mock, **development builds only** (production disables sign-in) |

No `auth` section = sign-in disabled: public routes work, private routes show "Sign-in
unavailable" (fail closed). Client secrets never go in the manifest (it is public); unknown keys
are rejected by the schema.

## Where the BFF is reached: `<base>/auth`

The browser never calls the BFF's own host. The shell's container proxies **`<base>/auth/...`**
(`/auth/...` for a shell at `/`, `/citizen/auth/...` for base path `/citizen`) to `AUTH_UPSTREAM`
with the prefix stripped, so the BFF endpoints below are served at its root (or below the path in
`AUTH_UPSTREAM`): `GET <AUTH_UPSTREAM>/session`, `GET /login`, `POST /logout`. Generated
manifests contain exactly these relative URLs ([configuration.md](configuration.md)).

- The BFF sees `X-Forwarded-Host`, `X-Forwarded-Proto` and `X-Forwarded-Prefix`
  (`/citizen/auth`): build absolute callback and `returnTo` URLs from them. The IdP's registered
  redirect URI is therefore on the public domain, e.g. `https://portal.example.sg/citizen/auth/callback`.
- Session cookie `Path`: `/` is fine for a shell at `/`; for shells below a base path use
  `Path=/citizen` (`/business`) or distinct cookie names, so the two sessions never mix. `__Host-`
  needs `Path=/`, so use a distinct name per shell (`__Host-citizen`, `__Host-business`) or
  `__Secure-` with a `Path` there. nginx passes `Set-Cookie` through unchanged.
- API calls (`<base>/api`) carry the same cookie because they are on the same origin and path
  scope: keep `Path` at the shell's base (or `/`), not at `<base>/auth`.

## Endpoints the BFF must provide

### `GET sessionUrl`: who is signed in

Sent by the shell on start-up, when the tab becomes visible again, when `expiresAt` passes, and
after an API answered 401. `fetch(sessionUrl, { credentials: 'include', cache: 'no-store' })`.

| Response | Body                                                                     | Frontend state           |
| -------- | ------------------------------------------------------------------------ | ------------------------ |
| `200`    | `{ "user": {…}, "csrfToken": "…", "expiresAt": "2026-10-18T10:15:00Z" }` | signed in                |
| `401`    | anything                                                                 | signed out               |
| `200`    | `{ "user": null }` (tolerated)                                           | signed out               |
| other    | anything                                                                 | signed out + error panel |

`csrfToken` and `expiresAt` are optional but recommended. Must send `Cache-Control: no-store`.
Must not extend an idle timeout on its own if that matters (sliding expiry is the backend's call;
the frontend polls only on the events above).

**User object (PDPA data minimisation).** Only what the UI needs to show who is signed in:

```json
{ "id": "c-7f3a9e…", "name": "Tan Ah Kow", "roles": ["citizen"] }
```

| Field   | Type     | Rules                                                                                               |
| ------- | -------- | --------------------------------------------------------------------------------------------------- |
| `id`    | string   | Required. Opaque, stable, **not** the NRIC/UINFIN or email (e.g. a salted hash or internal user id) |
| `name`  | string   | Optional display name                                                                               |
| `roles` | string[] | Optional coarse roles for UI decisions only (show/hide). The API enforces authorisation             |

Do not put NRIC/UINFIN, email, phone, date of birth or address in the session response. A
feature that needs such data fetches it from its own API, authorised server-side, when needed.
`@org/auth` drops every field other than these three, so remotes only ever see them.

### `GET loginUrl?returnTo=<absolute URL>`: start sign-in (browser navigation)

The shell navigates the whole page (`window.location.assign`), e.g.
`/auth/login?returnTo=https%3A%2F%2Fportal.example.sg%2Fmy-profile`. The BFF:

- validates `returnTo` against an **allow-list of frontend origins** (no open redirect); reject
  or replace anything else,
- runs the provider flow (Singpass / SSO: authorization request with `state`, `nonce`, PKCE),
- on the callback, creates the server-side session, sets the session cookie and redirects (302/303)
  to `returnTo`.

### `POST logoutUrl`: sign out

`fetch(logoutUrl, { method: 'POST', credentials: 'include', headers: { 'X-CSRF-Token': csrfToken } })`.
The BFF checks the CSRF token, deletes the server-side session, expires the cookie
(`Max-Age=0`) and answers:

- `204` (or `200` without body): the frontend shows signed out, or
- `200 { "redirectUrl": "https://idp…/logout?…" }`: the frontend navigates there (IdP
  end-session / single logout, which returns to the app afterwards).

A `401` (already signed out) is treated as success. If the request fails, the frontend still
shows signed out but displays "Sign-out could not be confirmed".

## Cookies

| Attribute  | Value                                                                                                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HttpOnly` | always: JavaScript (including a compromised remote or vendor script) cannot read the session                                                                            |
| `Secure`   | always (HTTPS only; browsers treat `http://localhost` as secure for local testing)                                                                                      |
| `SameSite` | `Lax` (default recommendation) or `Strict`. Not `None` unless the BFF is cross-site, which also needs third-party cookies and is not recommended                        |
| Name       | `__Host-session` when the BFF is on the shell's origin (`Path=/`, no `Domain`): cannot be overwritten by sibling subdomains. Otherwise `__Secure-` prefix with a `Path` |
| Lifetime   | session cookie or `Max-Age` ≤ the absolute session timeout; the real expiry lives in the server-side session                                                            |

Transient cookies of the login flow (`state`/`nonce`) are the backend's; they need `SameSite=Lax`
for a redirect-based callback (or `None; Secure` if the IdP posts the callback with
`response_mode=form_post`).

## CSRF

1. `SameSite=Lax`/`Strict` on the session cookie (blocks cross-site POSTs carrying it).
2. **Synchroniser token:** the session response returns `csrfToken` (random, bound to the
   server-side session). Every state-changing request (`POST`, `PUT`, `PATCH`, `DELETE`) to the
   BFF/API must carry it in `X-CSRF-Token` (or `auth.csrfHeaderName`); the backend rejects a
   missing or wrong token with 403. Shell code reads it from `useAuth().csrfToken`; remotes can
   too (`@org/auth` is a shared singleton):

   ```ts
   const { csrfToken, csrfHeaderName } = useAuth();
   await http.post(apiRoutes.profile.update(), body, {
     credentials: 'include',
     headers: csrfToken ? { [csrfHeaderName]: csrfToken } : {},
   });
   ```

3. The backend also checks the `Origin` header of state-changing requests against the allow-list.

`GET` endpoints must not change state. Login CSRF is handled by the provider flow (`state`).

## CORS: when the BFF or an API is on another origin

The platform default is **same origin**: the shell container proxies `<base>/auth` and `<base>/api`
(see above), so there is no CORS, the cookie can be `__Host-`, and no third-party cookie rules
apply. The rest of this section only applies if you deliberately put absolute URLs in a
hand-written manifest (`validate-manifest` warns about them).

If the BFF must be on another origin:

- It must be **same-site** with the shell (same registrable domain) or `SameSite=Lax` cookies are
  not sent and browsers increasingly block third-party cookies. Check the Public Suffix List:
  `gov.sg` is a public suffix, so `a.gov.sg` and `b.gov.sg` are **different sites**.
- Answer with the shell's exact origin, never `*`:
  `Access-Control-Allow-Origin: https://portal.example.sg`, `Access-Control-Allow-Credentials: true`,
  `Vary: Origin`.
- Preflight (`OPTIONS`): `Access-Control-Allow-Methods: GET, POST` (+ what APIs need),
  `Access-Control-Allow-Headers: Accept, Content-Type, X-CSRF-Token`, `Access-Control-Max-Age`.
- Remotes are often served from other origins (CDN). That does not matter for auth: their code
  runs in the shell's page, so their requests have the shell's `Origin`.
- CSP of the shell: `connect-src` must list the BFF/API origins. The template has no variable for
  them any more (same origin is the supported setup); add them in
  `deploy/nginx/security-headers.inc.template` if you need this.

## Session expiry

- Idle and absolute timeouts are enforced by the BFF (backend-owned).
- The session response's `expiresAt` makes the shell re-check at that time; the shell also
  re-checks when the tab becomes visible.
- Any API answering **401** means the session is gone: call `useAuth().refresh()`. The session
  check then returns 401, the state becomes signed out, `<RequireAuth>` unmounts the private
  remote and shows the sign-in prompt (with `returnTo` = the current page).
- The frontend never extends or renews a session itself and never retries with stored
  credentials (it has none).

## Failure behaviour (frontend)

`createAuthClient` never throws. Network errors, CORS failures, timeouts, 5xx and malformed
bodies become "signed out" with an error message and a "Try again" button. Protected content is
never shown on error (fail closed). `<RequireAuth mode="redirect">` does not redirect while the
BFF is failing (no redirect loop).

## What the private-route guard does and does not do

`<RequireAuth>` does not render a private remote, so its `mf-manifest.json` and code are not
downloaded before sign-in (verified with the browser network log). That is a UX and bandwidth
boundary, **not** a security boundary: remote bundles are public static files. All data must be
protected by the BFF/API checking the session on every request.

## Backend checklist

- [ ] `GET sessionUrl`: 200 `{ user: { id, name?, roles? }, csrfToken, expiresAt }` / 401,
      `Cache-Control: no-store`; minimal user object (no NRIC/UINFIN, email, phone)
- [ ] `GET loginUrl?returnTo=`: validates `returnTo` against the frontend origin allow-list,
      runs Singpass / SSO, sets the session cookie, redirects to `returnTo`
- [ ] `POST logoutUrl`: checks CSRF, deletes the session, expires the cookie, 204 or
      `200 { redirectUrl }` for IdP logout
- [ ] Session cookie `HttpOnly; Secure; SameSite=Lax` (`__Host-` when same origin)
- [ ] CSRF token on every state-changing request + `Origin` check
- [ ] Reached at `<base>/auth` through the shell container (`AUTH_UPSTREAM`), cookie `Path`
      scoped to the shell; credentialed CORS only as a fallback (exact origin allow-list, same-site)
- [ ] Idle/absolute timeouts; 401 from every API when the session is gone
- [ ] Tokens (access/ID/refresh) never leave the server

## Local development

- `mfe-manifest.dev.json` (generated) uses `"auth": { "mock": true }`: "Sign in" signs in as
  `Dev User (mock)` without a backend (`@org/auth/mock`, stripped from production builds).
- To develop against a real or fake BFF, set `AUTH_UPSTREAM` in the shell's `.env` and give
  `mfe.devManifest.auth` the relative URLs (`<base>/auth/session|login|logout`): the zone's dev
  proxy forwards them like nginx does. The BFF must allow `http://localhost:<zone proxy port>`
  (3100 / 3200) in its `returnTo` allow-list.
- The A6 verification used a ~150-line fake BFF (HttpOnly `Secure; SameSite=Lax` cookie,
  credentialed CORS, CSRF-checked logout, fake IdP page) against a production build; see the
  phase report.
