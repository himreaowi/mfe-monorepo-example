import type {
  AuthClient,
  AuthError,
  AuthSession,
  AuthUser,
  BffAuthConfig,
  SignInOptions,
} from './types';

export const DEFAULT_CSRF_HEADER = 'X-CSRF-Token';
export const DEFAULT_RETURN_TO_PARAM = 'returnTo';
export const DEFAULT_TIMEOUT_MS = 10_000;

export type CreateAuthClientOptions = {
  /** Custom fetch (tests, instrumentation). Default: global fetch. */
  fetch?: typeof fetch;
  /** Full-page navigation. Default: `window.location.assign`. */
  navigate?: (url: string) => void;
  /** Base for root-relative URLs. Default: the page URL. */
  baseUrl?: string;
};

function pageUrl(): string {
  return typeof window !== 'undefined'
    ? window.location.href
    : 'http://localhost/';
}

function signedOut(error?: AuthError): AuthSession {
  return error ? { status: 'signedOut', error } : { status: 'signedOut' };
}

/**
 * Keep only the documented, PDPA-minimal user fields. Returns `null` if `id` is missing.
 * Anything else the BFF sends (email, NRIC, ...) is dropped on purpose.
 */
export function toAuthUser(value: unknown): AuthUser | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== 'string' || raw.id.length === 0) return null;
  const user: AuthUser = { id: raw.id };
  if (typeof raw.name === 'string') user.name = raw.name;
  if (
    Array.isArray(raw.roles) &&
    raw.roles.every((r): r is string => typeof r === 'string')
  ) {
    user.roles = [...raw.roles];
  }
  return user;
}

/** Parse the session endpoint's 200 body. */
export function parseSessionBody(body: unknown): AuthSession {
  if (!body || typeof body !== 'object') {
    return signedOut({
      code: 'invalid-response',
      message: 'Session response is not a JSON object.',
    });
  }
  const raw = body as Record<string, unknown>;
  // Tolerated: 200 { user: null } means signed out.
  if (raw.user === null) return signedOut();
  const user = toAuthUser(raw.user);
  if (!user) {
    return signedOut({
      code: 'invalid-response',
      message: 'Session response has no valid "user" (needs a string "id").',
    });
  }
  return {
    status: 'signedIn',
    user,
    ...(typeof raw.csrfToken === 'string' ? { csrfToken: raw.csrfToken } : {}),
    ...(typeof raw.expiresAt === 'string' ? { expiresAt: raw.expiresAt } : {}),
  };
}

function describeFailure(error: unknown, timedOut: boolean): AuthError {
  if (timedOut) {
    return {
      code: 'timeout',
      message: 'The sign-in service did not answer in time.',
    };
  }
  const detail = error instanceof Error ? error.message : String(error);
  return {
    code: 'network',
    message: `The sign-in service could not be reached (${detail}).`,
  };
}

/**
 * Session client for the BFF pattern (D6). All requests use `credentials: 'include'` so the
 * HttpOnly session cookie travels, also when the BFF is on another origin (it must then answer
 * CORS with the shell's exact origin and `Access-Control-Allow-Credentials: true`).
 *
 * Never throws: network errors, timeouts, 5xx and malformed bodies resolve to
 * `{ status: 'signedOut', error }`.
 */
export function createAuthClient(
  config: BffAuthConfig,
  options: CreateAuthClientOptions = {},
): AuthClient {
  const csrfHeaderName = config.csrfHeaderName ?? DEFAULT_CSRF_HEADER;
  const returnToParam = config.returnToParam ?? DEFAULT_RETURN_TO_PARAM;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const doFetch: typeof fetch = (...args) =>
    (options.fetch ?? globalThis.fetch)(...args);
  const navigate =
    options.navigate ?? ((url: string) => window.location.assign(url));
  const resolve = (url: string) =>
    new URL(url, options.baseUrl ?? pageUrl()).toString();

  async function request(
    url: string,
    init: RequestInit,
    signal?: AbortSignal,
  ): Promise<{ response?: Response; error?: AuthError }> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort);
    try {
      const response = await doFetch(resolve(url), {
        ...init,
        credentials: 'include',
        cache: 'no-store',
        signal: controller.signal,
      });
      return { response };
    } catch (error) {
      return { error: describeFailure(error, timedOut) };
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }

  return {
    kind: 'bff',

    async getSession({ signal } = {}) {
      const { response, error } = await request(
        config.sessionUrl,
        { method: 'GET', headers: { Accept: 'application/json' } },
        signal,
      );
      if (!response) return signedOut(error);
      if (response.status === 401) return signedOut();
      if (!response.ok) {
        return signedOut({
          code: 'http',
          status: response.status,
          message: `The sign-in service answered HTTP ${response.status}.`,
        });
      }
      try {
        return parseSessionBody(await response.json());
      } catch {
        return signedOut({
          code: 'invalid-response',
          message: 'Session response is not valid JSON.',
        });
      }
    },

    async signIn({ returnTo }: SignInOptions = {}) {
      const target = new URL(resolve(config.loginUrl));
      target.searchParams.set(
        returnToParam,
        new URL(returnTo ?? pageUrl(), pageUrl()).toString(),
      );
      navigate(target.toString());
      return null;
    },

    async signOut({ csrfToken } = {}) {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (csrfToken) headers[csrfHeaderName] = csrfToken;
      const { response, error } = await request(config.logoutUrl, {
        method: 'POST',
        headers,
      });
      if (!response) {
        return signedOut({
          code: error?.code ?? 'network',
          message: `Sign-out could not be confirmed: ${error?.message ?? 'no response'}`,
        });
      }
      if (!response.ok && response.status !== 401) {
        return signedOut({
          code: 'http',
          status: response.status,
          message: `Sign-out could not be confirmed (HTTP ${response.status}).`,
        });
      }
      if (response.status === 200) {
        try {
          const body = (await response.json()) as { redirectUrl?: unknown };
          // e.g. the identity provider's end-session page, which returns to the app afterwards
          if (typeof body?.redirectUrl === 'string' && body.redirectUrl) {
            navigate(body.redirectUrl);
          }
        } catch {
          /* empty or non-JSON body: nothing to follow */
        }
      }
      return signedOut();
    },
  };
}
