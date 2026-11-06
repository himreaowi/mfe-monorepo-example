import { useEffect, type ReactNode } from 'react';
import { Button } from '@org/ui';
import { useAuth } from './AuthProvider';
import type { AuthContextValue } from './types';
import styles from './RequireAuth.module.scss';

export type RequireAuthProps = {
  /**
   * What happens when signed out:
   * - `prompt` (default): show a sign-in panel in place of the content
   * - `redirect`: go straight to the login page (falls back to the panel if the BFF is
   *   unreachable, so there is no redirect loop)
   */
  mode?: 'prompt' | 'redirect';
  /** Shown while the session is checked or the browser is redirecting. */
  fallback?: ReactNode;
  /** Replace the default sign-in panel. */
  renderPrompt?: (auth: AuthContextValue) => ReactNode;
  /** Heading of the default panel. */
  title?: string;
  /** Where to return after sign-in. Default: the current URL. */
  returnTo?: string;
  /** Rendered only when signed in. Lazy content (e.g. `<RemoteApp>`) is not loaded before. */
  children: ReactNode;
};

function Status({ children }: { children: ReactNode }) {
  return (
    <div
      className={styles.status}
      role="status"
      aria-live="polite"
      data-testid="auth-status"
    >
      {children}
    </div>
  );
}

/** Default sign-in panel. */
export function SignInPrompt({
  auth,
  title = 'Sign in required',
  returnTo,
}: {
  auth: AuthContextValue;
  title?: string;
  returnTo?: string;
}) {
  const disabled = auth.status === 'disabled';
  const error = auth.error;
  return (
    <section
      className={styles.prompt}
      aria-labelledby="auth-prompt-title"
      data-testid="sign-in-prompt"
    >
      <h2 id="auth-prompt-title" className={styles.title}>
        {disabled ? 'Sign-in unavailable' : title}
      </h2>
      <p className={styles.copy}>
        {disabled
          ? 'This page needs a signed-in user, but sign-in is not configured for this environment.'
          : 'You need to sign in to see this page.'}
      </p>
      {error && !disabled ? (
        <p className={styles.error} role="alert" data-testid="auth-error">
          {error.message}
        </p>
      ) : null}
      {disabled ? null : (
        <div className={styles.actions}>
          <Button onClick={() => void auth.signIn({ returnTo })}>
            Sign in
          </Button>
          {error ? (
            <Button variant="secondary" onClick={() => void auth.refresh()}>
              Try again
            </Button>
          ) : null}
        </div>
      )}
    </section>
  );
}

/**
 * Route guard: renders `children` only for a signed-in user. Wrap the `<RemoteApp>` of an
 * `access:private` remote in it and the remote's code is not even downloaded before sign-in.
 *
 * This is a UX boundary, not a security one: remote bundles are public static files. Data is
 * protected by the BFF/API, which checks the session on every request.
 */
export function RequireAuth({
  mode = 'prompt',
  fallback,
  renderPrompt,
  title,
  returnTo,
  children,
}: RequireAuthProps) {
  const auth = useAuth();
  const shouldRedirect =
    mode === 'redirect' && auth.status === 'signedOut' && !auth.error;

  useEffect(() => {
    if (shouldRedirect) void auth.signIn({ returnTo });
  }, [shouldRedirect, auth, returnTo]);

  if (auth.status === 'signedIn') return <>{children}</>;
  if (auth.status === 'loading') {
    return <>{fallback ?? <Status>Checking sign-in…</Status>}</>;
  }
  if (auth.status === 'redirecting' || shouldRedirect) {
    return <>{fallback ?? <Status>Redirecting to sign-in…</Status>}</>;
  }
  return (
    <>
      {renderPrompt ? (
        renderPrompt(auth)
      ) : (
        <SignInPrompt auth={auth} title={title} returnTo={returnTo} />
      )}
    </>
  );
}
