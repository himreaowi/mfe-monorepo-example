/**
 * Auth types (decision D6: backend session / BFF). The browser never sees an access, ID or
 * refresh token: the BFF keeps them server-side and gives the browser an HttpOnly session
 * cookie. The frontend only learns *who* is signed in, through the session endpoint.
 * Contract: docs/auth-contract.md.
 */

/**
 * The signed-in user as the frontend sees it. Deliberately minimal (PDPA data minimisation):
 * an opaque id, a display name and coarse roles. No NRIC/FIN, email, phone, date of birth or
 * address: features that need such data fetch it from their own API, server-side authorised.
 * Fields the BFF sends beyond these are dropped by the session client.
 */
export type AuthUser = {
  /** Opaque, stable, non-identifying id (e.g. a hashed subject). Never an NRIC/FIN. */
  id: string;
  /** Display name for the header ("Signed in as ..."). */
  name?: string;
  /** Coarse roles/entitlements for UI decisions only. The API enforces authorisation. */
  roles?: string[];
};

export type AuthErrorCode =
  /** The BFF could not be reached (offline, DNS, CORS, connection refused). */
  | 'network'
  /** The BFF did not answer within `timeoutMs`. */
  | 'timeout'
  /** Unexpected HTTP status (5xx, 404, ...). */
  | 'http'
  /** 2xx but the body is not the documented JSON. */
  | 'invalid-response'
  /** No usable auth configuration (missing `auth` in mfe-manifest.json, or mock in production). */
  | 'not-configured';

export type AuthError = {
  code: AuthErrorCode;
  message: string;
  /** HTTP status for `http` errors. */
  status?: number;
};

/**
 * Result of a session check. Errors never throw: they come back as `signedOut` with `error`
 * set, so a broken BFF can never show protected content.
 */
export type AuthSession =
  | {
      status: 'signedIn';
      user: AuthUser;
      /** Anti-CSRF token bound to the session, sent as a header on state-changing requests. */
      csrfToken?: string;
      /** ISO 8601 time the session expires (idle or absolute). The provider re-checks then. */
      expiresAt?: string;
    }
  | { status: 'signedOut'; error?: AuthError };

/** BFF endpoints, from the `auth` section of mfe-manifest.json (per environment). */
export type BffAuthConfig = {
  /** GET: 200 `{ user, csrfToken?, expiresAt? }` when signed in, 401 when not. */
  sessionUrl: string;
  /** Browser navigation target that starts sign-in (Singpass / SSO, backend-owned). */
  loginUrl: string;
  /** POST (with the CSRF header): ends the session. 204, or 200 `{ redirectUrl? }`. */
  logoutUrl: string;
  /** Header that carries `csrfToken` on POST/PUT/PATCH/DELETE. Default `X-CSRF-Token`. */
  csrfHeaderName?: string;
  /** Query parameter for the return URL on `loginUrl`. Default `returnTo`. */
  returnToParam?: string;
  /** Session request timeout in ms. Default 10000. */
  timeoutMs?: number;
};

/**
 * The `auth` section of mfe-manifest.json. `{ "mock": true }` selects the dev-only mock client
 * (ignored by production builds, which then disable sign-in).
 */
export type ManifestAuthConfig = Partial<BffAuthConfig> & {
  mock?: boolean;
  /**
   * With `mock`: the fake user the mock signs in as (default "Dev User (mock)"), e.g. a
   * Corppass-style business user for a business shell. Development builds only.
   */
  mockUser?: AuthUser;
};

export type SignInOptions = {
  /**
   * Where the BFF sends the browser back after sign-in. Default: the current URL. Must be on
   * the shell's origin; the BFF validates it against an allow-list (no open redirects).
   */
  returnTo?: string;
};

/** Talks to the BFF (or fakes it). Every method resolves; none throws. */
export interface AuthClient {
  readonly kind: 'bff' | 'mock';
  /** Ask the BFF who is signed in (`credentials: 'include'`). */
  getSession(options?: { signal?: AbortSignal }): Promise<AuthSession>;
  /**
   * Start sign-in. The BFF client navigates the browser to `loginUrl` and resolves `null` (the
   * page unloads). The mock client signs in immediately and resolves the new session.
   */
  signIn(options?: SignInOptions): Promise<AuthSession | null>;
  /** End the session. Resolves `signedOut` (with `error` if the BFF could not confirm). */
  signOut(options?: { csrfToken?: string }): Promise<AuthSession>;
}

export type AuthStatus =
  /** First session check in flight. */
  | 'loading'
  | 'signedIn'
  | 'signedOut'
  /** Navigating to the login page. */
  | 'redirecting'
  /** No auth client (no `auth` in mfe-manifest.json). Private routes stay closed. */
  | 'disabled';

/** What `useAuth()` returns. */
export type AuthContextValue = {
  status: AuthStatus;
  /** `null` unless signed in. */
  user: AuthUser | null;
  /** Last error (BFF unreachable, sign-out not confirmed, not configured). */
  error: AuthError | null;
  /** Anti-CSRF token for state-changing API calls, `null` unless signed in. */
  csrfToken: string | null;
  /** Header name for `csrfToken` (from the manifest, default `X-CSRF-Token`). */
  csrfHeaderName: string;
  /** `bff`, `mock` or `null` (disabled). */
  clientKind: AuthClient['kind'] | null;
  signIn(options?: SignInOptions): Promise<void>;
  signOut(): Promise<void>;
  /**
   * Re-check the session. Call it when an API answers 401 (session expired): the state then
   * becomes `signedOut` and guarded routes show the sign-in prompt again.
   */
  refresh(): Promise<void>;
};
