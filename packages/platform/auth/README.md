# @org/auth

Provider-agnostic sign-in for shells and remotes, using the **backend session (BFF) pattern**
(decision D6): the browser never handles access, ID or refresh tokens. A backend-for-frontend
does the Singpass / SSO dance, keeps the tokens server-side and gives the browser an HttpOnly
session cookie. The frontend only asks the BFF "who is signed in?".

The BFF endpoints and what the backend must provide: [docs/auth-contract.md](../../../docs/auth-contract.md).

## Shell

```tsx
// src/main.tsx
const manifest = await loadMfeManifest();
const authClient = await loadAuthClient(manifest.auth); // AuthClient | null

// src/app/App.tsx
<AuthProvider client={authClient} csrfHeaderName={manifest.auth?.csrfHeaderName}>
  <BrowserRouter>…</BrowserRouter>
</AuthProvider>

// header actions in the shell's own layout (src/layouts/ShellLayout)
<ThemeToggle />
<UserMenu />

// route of an access:private remote
<RequireAuth title="Sign in to use My Profile">
  <RemoteApp name="internet_my_profile" props={{ user }} />
</RequireAuth>
```

The generated shell does all of this (`pnpm gen:shell`).

| Export                                                                  | What                                                                                                                                                                         |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `loadAuthClient(manifest.auth)`                                         | BFF client for `{ sessionUrl, loginUrl, logoutUrl }`; dev-only mock for `{ mock: true }`; `null` (disabled) when missing, incomplete, or `mock` in a production build        |
| `createAuthClient(config, { fetch?, navigate? })`                       | The BFF session client. `credentials: 'include'`, `cache: 'no-store'`, timeout. **Never throws**: network errors, timeouts, 5xx, bad JSON → `{ status: 'signedOut', error }` |
| `<AuthProvider client csrfHeaderName? refreshOnFocus? initialSession?>` | Session state for the page. Checks on mount, when the tab becomes visible and when `expiresAt` passes                                                                        |
| `useAuth()`                                                             | `{ status, user, error, csrfToken, csrfHeaderName, clientKind, signIn(), signOut(), refresh() }`. Outside a provider: `status: 'disabled'` (no throw)                        |
| `<RequireAuth mode? fallback? renderPrompt? title? returnTo?>`          | Renders children only when signed in. `prompt` (default): sign-in panel; `redirect`: straight to `loginUrl` (panel if the BFF is down, no loop). Disabled auth fails closed  |
| `<UserMenu />`                                                          | "Sign in" / name + "Sign out" for the header                                                                                                                                 |
| `SignInPrompt`, `parseSessionBody`, `toAuthUser`, types                 | Building blocks                                                                                                                                                              |
| `@org/auth/mock`: `createMockAuthClient()`                              | **Development only.** Never import it from app code; `loadAuthClient` imports it behind `process.env.NODE_ENV !== 'production'`, so production builds do not contain it      |

`status`: `loading` → `signedIn` | `signedOut` (`error` set if the BFF failed) | `redirecting` |
`disabled` (no auth configured).

`AuthUser` is PDPA-minimal: `{ id, name?, roles? }`. The client drops every other field the BFF
sends.

## Remotes

`@org/auth` is a **tier-1 singleton** (`TIER1_SINGLETONS`): the shell and every remote share one
copy at runtime, so a remote's `useAuth()` reads the shell's `AuthProvider` (signed-in state,
`csrfToken`, `signOut`, `refresh` after an API 401). In addition the shell passes `user` to
every remote as a host prop (`useHostProps().user`), which is all most remotes need and also
works for external modules. Remotes never render their own `AuthProvider`.

Running standalone, a remote has no provider: `useAuth()` returns `status: 'disabled'` and the
mock `user` comes from `standaloneProps` (in the remote's `src/app/apps.tsx`).

## Why a singleton, and props as well

- The session is cross-app state with a React context. Without sharing, a remote importing
  `@org/auth` would get its own context and see "disabled" (the same failure as two
  react-router copies, see docs/toolchain.md). D4: such libraries are tier 1.
- `user` as a host prop keeps the simple case simple and is the only option for remotes that
  do not use React context from the shell (external/vendor modules get `user` via the mount
  contract).

## Development mock

The generated shell's `mfe-manifest.dev.json` has `"auth": { "mock": true }`: "Sign in" signs in
as `Dev User (mock)` (kept in `sessionStorage`), no backend needed. A production build ignores
`mock` (sign-in is then disabled and private routes stay closed) and does not contain the mock
code; the A6 verification grepped the production bundles for its marker
(`org-auth-mock-client`): 0 matches, while a development build contains it.
