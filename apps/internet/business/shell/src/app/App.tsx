import type { ReactNode } from 'react';
import { BrowserRouter, useRoutes } from 'react-router';
import { AuthProvider, useAuth, type AuthClient } from '@org/auth';
import { MfeManifestProvider, type MfeManifest } from '@org/mf-runtime';
import { createQueryClient, QueryProvider } from '@org/query';
import { ThemeProvider } from '@org/ui';
import { BASE_PATH } from '@/core/constants/app';
import { remotes } from './registry';
import { createRoutes } from './routes';

const routes = createRoutes(remotes);
/** The shell's own data (each remote has its own client). Lives as long as the page. */
const queryClient = createQueryClient();

function AppRoutes() {
  return useRoutes(routes);
}

/**
 * What depends on the session: the query cache belongs to the signed-in user (cleared when the
 * user changes), and a 401 from `useApiClient()` re-checks the session.
 */
function SessionData({
  manifest,
  children,
}: {
  manifest: MfeManifest;
  children: ReactNode;
}) {
  const { user, refresh } = useAuth();
  return (
    <QueryProvider client={queryClient} userId={user?.id}>
      <MfeManifestProvider manifest={manifest} onUnauthorized={refresh}>
        {children}
      </MfeManifestProvider>
    </QueryProvider>
  );
}

export type AppProps = {
  manifest: MfeManifest;
  /** From `loadAuthClient(manifest.auth)`; `null` = sign-in disabled. */
  authClient: AuthClient | null;
};

/**
 * Providers (theme, auth, query, manifest) + router. The shell owns the document theme and the
 * session state; @org/ui and @org/auth are shared singletons, so remotes see the same
 * providers.
 */
export function App({ manifest, authClient }: AppProps) {
  return (
    <ThemeProvider>
      <AuthProvider
        client={authClient}
        csrfHeaderName={manifest.auth?.csrfHeaderName}
      >
        <SessionData manifest={manifest}>
          {/* below a base path (/citizen) every route and link is relative to it */}
          <BrowserRouter basename={BASE_PATH}>
            <AppRoutes />
          </BrowserRouter>
        </SessionData>
      </AuthProvider>
    </ThemeProvider>
  );
}
