import { RequireAuth, useAuth } from '@org/auth';
import { RemoteApp } from '@org/mf-runtime';
import type { RemoteEntry } from '@/core/types/remotes';

/**
 * Mounts one remote below its splat route. Load errors show RemoteFallback (with retry) inside
 * the layout; the shell keeps working.
 *
 * - Every remote gets host prop `user` (`null` when signed out, `undefined` when the
 *   environment has no auth).
 * - `onUnauthorized`: an API call of the remote answered 401, re-check the session (an expired
 *   session becomes `user: null`).
 * - `access: 'private'` remotes are wrapped in `<RequireAuth>`: until the session check says
 *   "signed in", `<RemoteApp>` is not rendered, so the remote's mf-manifest.json and code are
 *   not downloaded. Signing out unmounts it again.
 */
export function RemotePage({ remote }: { remote: RemoteEntry }) {
  const { status, user, refresh } = useAuth();
  const app = (
    <RemoteApp
      name={remote.federationName}
      props={{
        title: remote.title,
        user: status === 'disabled' ? undefined : user,
        onUnauthorized: refresh,
      }}
    />
  );
  return (
    <div data-testid={`remote-page-${remote.name}`}>
      {remote.access === 'private' ? (
        <RequireAuth title={`Sign in to use ${remote.title}`}>{app}</RequireAuth>
      ) : (
        app
      )}
    </div>
  );
}
