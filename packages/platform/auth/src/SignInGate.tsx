import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { Spinner } from '@org/ui';
import { useAuth } from './AuthProvider';

export type SignInGateProps = {
  /** `false`: renders `children` as is (open portal). */
  required: boolean;
  /** Signed out: show `landing`, or `redirect` straight to the sign-in page. */
  mode: 'landing' | 'redirect';
  /**
   * The shell's landing page (title, text, a button calling `signIn()`). Also shown in
   * `redirect` mode when the BFF fails, after a sign-out in this page and when sign-in is
   * not configured (`status: 'disabled'`): it should say so then.
   */
  landing: ReactNode;
  /** The shell's chrome while signed out (e.g. a brand-only header). Default: none. */
  layout?: ComponentType<{ children: ReactNode }>;
  /** The portal (layout, nav, routes, remotes): rendered only for a signed-in user. */
  children: ReactNode;
};

function Bare({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/**
 * Sign-in for a whole portal. Until the session check says "signed in", `children` are not
 * rendered: no nav, no route, no `<RemoteApp>`, so no remote's mf-manifest.json or code is
 * downloaded. Signed out, `layout` shows:
 *
 * - while the session is checked or the browser goes to the sign-in page: a spinner;
 * - `landing` mode: `landing`;
 * - `redirect` mode: `signIn()` right away (back to the current address); `landing` when the
 *   BFF is unreachable (no redirect loop), after a sign-out in this page (no bounce back into
 *   single sign-on) and when sign-in is not configured.
 *
 * Sign-in not configured (`status: 'disabled'`): fails closed like RequireAuth. A UX boundary,
 * not a security one (see RequireAuth).
 */
export function SignInGate({
  required,
  mode,
  landing,
  layout: Layout = Bare,
  children,
}: SignInGateProps) {
  const auth = useAuth();
  // signed in at some point in this page: a later sign-out shows `landing`, even in redirect mode
  const [hadSession, setHadSession] = useState(false);
  if (auth.status === 'signedIn' && !hadSession) setHadSession(true);
  const shouldRedirect =
    required &&
    mode === 'redirect' &&
    auth.status === 'signedOut' &&
    !auth.error &&
    !hadSession;

  useEffect(() => {
    if (shouldRedirect) void auth.signIn();
  }, [shouldRedirect, auth]);

  if (!required || auth.status === 'signedIn') return <>{children}</>;
  const busy =
    auth.status === 'loading' ||
    auth.status === 'redirecting' ||
    shouldRedirect;
  return (
    <Layout>
      {busy ? (
        <Spinner
          size="lg"
          label={
            auth.status === 'loading'
              ? 'Checking sign-in…'
              : 'Redirecting to sign-in…'
          }
          data-testid="sign-in-gate-busy"
        />
      ) : (
        landing
      )}
    </Layout>
  );
}
