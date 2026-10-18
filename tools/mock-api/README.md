# @org/mock-api (dev only)

A small **mock JSON API per zone** for local development and e2e: `node:http`, in-memory data,
no dependencies. Apps never hard-code its URL: each shell's `mfe-manifest.dev.json` sets
`settings.apiBaseUrl`, the shell passes `settings` to every remote as a host prop, and the
remotes build their HTTP client (`@org/http-client`) from it. Production manifests point
`apiBaseUrl` at the real API (or the BFF route) instead. Never deploy this package.

```sh
pnpm --filter @org/mock-api serve:intranet   # http://localhost:3190/api
pnpm --filter @org/mock-api serve:internet   # http://localhost:3290/api
```

`pnpm dev:<zone>` starts the zone's mock API automatically (Nx task dependency
`serve:<zone>` of the generated shell and remotes), and so does `pnpm exec nx dev <app>`.
Ports come from the zone's **tools range** (`tools/scripts/src/zones.js`: intranet 3190–3199,
internet 3290–3299) and the offset `mfe.tools.mockApi` in the root `package.json` (0 → 3190 /
3290), so both zones run at the same time.

| Method | Path                        | What                                                      |
| ------ | --------------------------- | --------------------------------------------------------- |
| GET    | `/api/health`               | `{ ok: true, zone }` (e2e waits for it)                   |
| GET    | `/api/items?q=`             | example list (the generated remotes' demo feature)        |
| GET    | `/api/items/:id`            | one item, 404 if unknown                                  |
| POST   | `/api/items`                | `{ name, description? }` → 201, or 422 with `errors.name` |
| POST   | `/__reset` (`/api/__reset`) | restore the seed data (tests)                             |

Example domain endpoints (below `/api`; `src/intranet.js`, `src/internet.js`):

| Zone     | Method | Path                      | Used by                     |
| -------- | ------ | ------------------------- | --------------------------- |
| intranet | GET    | `/staff?q=&department=`   | staff-directory             |
| intranet | GET    | `/staff/:id`              | staff-directory             |
| intranet | GET    | `/leave/balance`          | leave-requests              |
| intranet | GET    | `/leave/requests`         | leave-requests              |
| intranet | POST   | `/leave/requests`         | leave-requests (422 errors) |
| intranet | GET    | `/helpdesk/tickets[/:id]` | it-helpdesk vendor module   |
| intranet | POST   | `/helpdesk/tickets`       | it-helpdesk vendor module   |
| internet | GET    | `/services?q=&category=`  | services                    |
| internet | GET    | `/services/:slug`         | services                    |
| internet | GET    | `/announcements[/:id]`    | announcements               |
| internet | GET    | `/profile/me`             | my-profile                  |
| internet | PUT    | `/profile/me/preferences` | my-profile (`X-CSRF-Token`) |

The template's `/items` resource is kept, so the demo feature of a newly generated remote
works. The mock has no session: `/profile/me` answers for the `@org/auth` dev mock user and
the preferences update checks the mock CSRF token (`mock-csrf-token`), like the real API checks
the token bound to the BFF session ([docs/auth-contract.md](../../docs/auth-contract.md)).

- CORS like a cross-origin API with cookie sessions: the request `Origin` is echoed for
  `http://localhost:*` / `http://127.0.0.1:*` only, with `Access-Control-Allow-Credentials: true`;
  preflight allows `Content-Type` and `X-CSRF-Token`.
- Validation errors: `422 { "message", "errors": { "<field>": "<message>" } }`
  (`HttpClientError.body` in the apps).
- `MOCK_API_DELAY=800 pnpm dev:<zone>` slows every response down (loading states);
  `MOCK_API_LOG=1` logs requests.

## Adding endpoints

A resource is `{ routes, reset }` (see `src/items.js`): routes are
`{ method, path: '/things/:id', handler({ params, query, body, headers }) → { status, body } }`
relative to `/api`; `reset()` restores its seed. Register it for the zone(s) that use it in
`ZONE_RESOURCES` (`src/index.js`). Keep mocks small and close to the real API contract; flows
that need a real backend belong in a shared test environment, not here.

Tests: `pnpm --filter @org/mock-api test` (node --test; `test/domain.test.js` covers the
example's endpoints).
