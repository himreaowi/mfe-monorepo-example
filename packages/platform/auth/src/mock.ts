/**
 * DEVELOPMENT ONLY mock auth client: "sign in" as a fake user without a BFF.
 *
 * Never import this from app code. `loadAuthClient()` imports it dynamically behind a
 * `process.env.NODE_ENV !== 'production'` check, so production builds drop it entirely
 * (verified by grepping the production bundle for MOCK_AUTH_MARKER).
 */
import type { AuthClient, AuthSession, AuthUser } from './types';

/** Searched for in production bundles by the verification (must be absent). */
export const MOCK_AUTH_MARKER = 'org-auth-mock-client';

export const MOCK_USER: AuthUser = {
  id: 'mock-user-1',
  name: 'Dev User (mock)',
  roles: ['user'],
};

export type MockAuthClientOptions = {
  /** The fake user. Default MOCK_USER. */
  user?: AuthUser;
  /** Where the signed-in flag lives (survives reloads). Default `sessionStorage`. */
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  /** Start signed in (when nothing is stored yet). Default false. */
  signedIn?: boolean;
};

/**
 * sessionStorage key of the signed-in flag. A custom user gets its own key, so two shells on one
 * origin with different mock users (e.g. /citizen and /business behind the zone's dev proxy)
 * keep separate sessions, like BFF cookies scoped to each shell's path.
 */
export function mockStorageKey(user: AuthUser | undefined): string {
  return user ? `${MOCK_AUTH_MARKER}:${user.id}` : MOCK_AUTH_MARKER;
}

function defaultStorage(): MockAuthClientOptions['storage'] {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

export function createMockAuthClient(
  options: MockAuthClientOptions = {},
): AuthClient {
  const user = options.user ?? MOCK_USER;
  const STORAGE_KEY = mockStorageKey(options.user);
  const storage =
    options.storage === undefined ? defaultStorage() : options.storage;
  let memory = options.signedIn ?? false;

  const read = (): boolean => {
    const stored = storage?.getItem(STORAGE_KEY);
    return stored === null || stored === undefined ? memory : stored === '1';
  };
  const write = (value: boolean) => {
    memory = value;
    if (value) storage?.setItem(STORAGE_KEY, '1');
    else storage?.setItem(STORAGE_KEY, '0');
  };
  const session = (): AuthSession =>
    read()
      ? { status: 'signedIn', user, csrfToken: 'mock-csrf-token' }
      : { status: 'signedOut' };

  console.info(
    `[auth] Using the MOCK auth client (${MOCK_AUTH_MARKER}). Development builds only; production uses the BFF from mfe-manifest.json "auth".`,
  );

  return {
    kind: 'mock',
    async getSession() {
      return session();
    },
    async signIn() {
      write(true);
      return session();
    },
    async signOut() {
      write(false);
      return session();
    },
  };
}
