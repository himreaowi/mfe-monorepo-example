import { BrowserRouter, useRoutes } from 'react-router';
import { AuthProvider, type AuthClient } from '@org/auth';
import { MfeManifestProvider, type MfeManifest } from '@org/mf-runtime';
import { ThemeProvider } from '@org/ui';
import { BASE_PATH } from '@/core/constants/app';
import { remotes } from './registry';
import { createRoutes } from './routes';

const routes = createRoutes(remotes);

function AppRoutes() {
  return useRoutes(routes);
}

export type AppProps = {
  manifest: MfeManifest;
  /** From `loadAuthClient(manifest.auth)`; `null` = sign-in disabled. */
  authClient: AuthClient | null;
};

/**
 * Providers (theme, auth, manifest) + router. The shell owns the document theme and the
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
        <MfeManifestProvider manifest={manifest}>
          {/* below a base path (/citizen) every route and link is relative to it */}
          <BrowserRouter basename={BASE_PATH}>
            <AppRoutes />
          </BrowserRouter>
        </MfeManifestProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
