import type { ComponentType, ReactNode } from 'react';
import {
  BrowserRouter,
  useInRouterContext,
  useRoutes,
  type RouteObject,
} from 'react-router';
import { ThemeProvider } from '@org/ui';
import { normalizeBasePath, type HostProps } from '../hostProps';
import { HostPropsProvider } from './HostPropsContext';

export type CreateRemoteAppOptions = {
  /**
   * The remote's routes, with RELATIVE paths (`index`, `'route-1'`, `'items/:id'`).
   * In a shell they match below the shell's mount (e.g. `/apps/staff/*`); standalone they match
   * from `/`.
   */
  routes: RouteObject[];
  /** Mock host props for standalone mode (e.g. a fake user, settings.apiBaseUrl). */
  standaloneProps?: Partial<HostProps>;
  /** Chrome around the routes in standalone mode only (the remote's own `StandaloneLayout`). */
  StandaloneLayout?: ComponentType<{ children: ReactNode }>;
};

export type RemoteAppParts = {
  /** Default export of the exposed module (`./App`). Rendered by the shell's `<RemoteApp>`. */
  EmbeddedApp: ComponentType<HostProps>;
  /** Rendered by the remote's own bootstrap when it runs standalone (`pnpm dev`). */
  StandaloneApp: ComponentType<Partial<HostProps>>;
};

/**
 * Build the two entry components of a remote (ported from starter-mfe FederatedRemoteApp).
 *
 * Embedded (in a shell):
 * - uses the shell's router (shared react-router singleton); routes are relative to the shell's
 *   splat mount. Without a surrounding router it creates a BrowserRouter with
 *   `basename = basePath`.
 * - wraps itself in `ThemeProvider`, which passes through to the shell's provider (shared
 *   @org/ui) or follows the shell's `<html>` theme. It never takes over the document theme.
 * - provides `HostProps` via `useHostProps()`.
 * - does not import global styles and does not register a service worker.
 *
 * Standalone: own `ThemeProvider` (root), own `BrowserRouter`, mock host props
 * (`embedded: false`, `basePath: '/'`), optional `StandaloneLayout`.
 */
export function createRemoteApp({
  routes,
  standaloneProps = {},
  StandaloneLayout,
}: CreateRemoteAppOptions): RemoteAppParts {
  function RemoteRoutes() {
    return useRoutes(routes);
  }

  function EmbeddedApp(props: HostProps) {
    const inRouter = useInRouterContext();
    const value: HostProps = {
      ...props,
      embedded: true,
      basePath: normalizeBasePath(props.basePath),
    };
    const content = (
      <ThemeProvider>
        <HostPropsProvider value={value}>
          <RemoteRoutes />
        </HostPropsProvider>
      </ThemeProvider>
    );
    return inRouter ? (
      content
    ) : (
      <BrowserRouter basename={value.basePath}>{content}</BrowserRouter>
    );
  }
  EmbeddedApp.displayName = 'EmbeddedRemoteApp';

  function StandaloneApp(props: Partial<HostProps>) {
    const value: HostProps = {
      ...standaloneProps,
      ...props,
      embedded: false,
      basePath: '/',
    };
    const routed = <RemoteRoutes />;
    return (
      <ThemeProvider>
        <HostPropsProvider value={value}>
          <BrowserRouter>
            {StandaloneLayout ? (
              <StandaloneLayout>{routed}</StandaloneLayout>
            ) : (
              routed
            )}
          </BrowserRouter>
        </HostPropsProvider>
      </ThemeProvider>
    );
  }
  StandaloneApp.displayName = 'StandaloneRemoteApp';

  return { EmbeddedApp, StandaloneApp };
}
