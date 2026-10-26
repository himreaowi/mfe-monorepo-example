import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { DEFAULT_CSRF_HEADER } from './client';
import type {
  AuthClient,
  AuthContextValue,
  AuthError,
  AuthSession,
  AuthStatus,
  SignInOptions,
} from './types';

const noop = async () => undefined;

/** Value outside any provider (e.g. a remote running standalone): auth disabled. */
const DISABLED: AuthContextValue = {
  status: 'disabled',
  user: null,
  error: null,
  csrfToken: null,
  csrfHeaderName: DEFAULT_CSRF_HEADER,
  clientKind: null,
  signIn: noop,
  signOut: noop,
  refresh: noop,
};

const AuthContext = createContext<AuthContextValue>(DISABLED);
AuthContext.displayName = 'AuthContext';

type State = {
  status: AuthStatus;
  session: AuthSession | null;
  error: AuthError | null;
};

/** Longest delay setTimeout accepts. */
const MAX_TIMEOUT = 2 ** 31 - 1;

export type AuthProviderProps = {
  /** From `loadAuthClient(manifest.auth)`. `null` = auth disabled (private routes stay closed). */
  client: AuthClient | null;
  /** Header for the CSRF token (mfe-manifest.json `auth.csrfHeaderName`). */
  csrfHeaderName?: string;
  /** Re-check the session when the tab becomes visible again. Default true. */
  refreshOnFocus?: boolean;
  /** Skip the first request (tests, SSR). */
  initialSession?: AuthSession;
  children: ReactNode;
};

function fromSession(session: AuthSession): State {
  return {
    status: session.status,
    session,
    error: session.status === 'signedOut' ? (session.error ?? null) : null,
  };
}

/**
 * Holds the session state for the whole page. Put it in the shell, around the router.
 * `@org/auth` is a tier-1 Module Federation singleton, so a remote that calls `useAuth()` reads
 * this same context. The shell also passes `user` to every remote as a host prop.
 *
 * - checks the session on mount (`GET sessionUrl`)
 * - re-checks when the tab becomes visible and when `expiresAt` passes (→ signed out)
 * - `refresh()` after an API 401 turns an expired session into `signedOut`
 */
export function AuthProvider({
  client,
  csrfHeaderName = DEFAULT_CSRF_HEADER,
  refreshOnFocus = true,
  initialSession,
  children,
}: AuthProviderProps) {
  const [state, setState] = useState<State>(() =>
    !client
      ? {
          status: 'disabled',
          session: null,
          error: {
            code: 'not-configured',
            message:
              'Sign-in is not configured for this environment (mfe-manifest.json "auth").',
          },
        }
      : initialSession
        ? fromSession(initialSession)
        : { status: 'loading', session: null, error: null },
  );
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    if (!client) return;
    const id = ++requestId.current;
    const session = await client.getSession();
    // a newer request (or sign-in/out) superseded this one
    if (id !== requestId.current) return;
    setState(fromSession(session));
  }, [client]);

  useEffect(() => {
    if (!client || initialSession) return;
    let active = true;
    const id = ++requestId.current;
    void client.getSession().then((session) => {
      // ignore the answer if the provider unmounted or a newer request superseded it
      if (active && id === requestId.current) setState(fromSession(session));
    });
    return () => {
      active = false;
    };
  }, [client, initialSession]);

  useEffect(() => {
    if (!client || !refreshOnFocus) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [client, refreshOnFocus, refresh]);

  const expiresAt =
    state.session?.status === 'signedIn' ? state.session.expiresAt : undefined;
  useEffect(() => {
    if (!expiresAt) return;
    const delay = Date.parse(expiresAt) - Date.now();
    if (Number.isNaN(delay)) return;
    const timer = setTimeout(
      () => void refresh(),
      Math.min(Math.max(delay, 0) + 500, MAX_TIMEOUT),
    );
    return () => clearTimeout(timer);
  }, [expiresAt, refresh]);

  const signIn = useCallback(
    async (options?: SignInOptions) => {
      if (!client) return;
      const id = ++requestId.current;
      setState((s) => ({ ...s, status: 'redirecting', error: null }));
      const session = await client.signIn(options);
      if (session && id === requestId.current) setState(fromSession(session));
    },
    [client],
  );

  const csrfToken =
    state.session?.status === 'signedIn'
      ? (state.session.csrfToken ?? null)
      : null;

  const signOut = useCallback(async () => {
    if (!client) return;
    const id = ++requestId.current;
    const session = await client.signOut({ csrfToken: csrfToken ?? undefined });
    if (id === requestId.current) setState(fromSession(session));
  }, [client, csrfToken]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status: state.status,
      user:
        state.session?.status === 'signedIn' && state.status === 'signedIn'
          ? state.session.user
          : null,
      error: state.error,
      csrfToken: state.status === 'signedIn' ? csrfToken : null,
      csrfHeaderName,
      clientKind: client?.kind ?? null,
      signIn,
      signOut,
      refresh,
    }),
    [state, csrfToken, csrfHeaderName, client, signIn, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * The auth state. Outside an `AuthProvider` (e.g. a remote running standalone) it returns a
 * disabled state instead of throwing.
 */
export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
