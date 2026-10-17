# @org/mock-api (dev only)

Mock backend APIs for the example zones: JSON over HTTP, in-memory data, no dependencies. Apps
never hard-code its URL: each shell's `mfe-manifest.dev.json` sets `settings.apiBaseUrl`, the
shell passes `settings` to every remote as a host prop, and remotes build their HTTP client from
it. Production manifests point `apiBaseUrl` at the real API (or the BFF route) instead.

```sh
pnpm --filter @org/mock-api serve:intranet   # http://localhost:3910/api
pnpm --filter @org/mock-api serve:internet   # http://localhost:3920/api
```

`pnpm dev:<zone>` starts it automatically (the remotes' `nx.targets.dev.dependsOn`), and so does
`pnpm exec nx dev <remote>`.

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
| both     | GET    | `/health`                 |                             |
| both     | POST   | `/__reset`                | tests: restore the seed     |

- CORS like a cross-origin API with cookie sessions: the request `Origin` is echoed for
  `http://localhost:*` only, with `Access-Control-Allow-Credentials: true`.
- The mock has no session. `/profile/me` answers for the `@org/auth` dev mock user and the
  preferences update checks the mock CSRF token (`mock-csrf-token`), like the real API checks
  the token bound to the BFF session (docs/auth-contract.md).
- Validation errors: `422 { "message", "errors": { "<field>": "<message>" } }`.
- `MOCK_API_DELAY=400` (ms) slows every response down to look at loading states;
  `MOCK_API_LOG=1` logs requests.

Never deploy this package.
