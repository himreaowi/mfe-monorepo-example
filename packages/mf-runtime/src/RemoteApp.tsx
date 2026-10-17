import {
  Component,
  Suspense,
  lazy,
  useCallback,
  useMemo,
  useState,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { useInRouterContext, useLocation, useParams } from 'react-router';
import { loadRemote } from '@module-federation/enhanced/runtime';
import { RemoteFallback } from '@org/ui';
import { normalizeBasePath, type HostProps } from './hostProps';
import { resolveRemoteEntry } from './manifest/manifest';
import { resetRemote } from './initRemotes';
import { useMfeManifest } from './ManifestContext';

export type RemoteAppProps = {
  /** Federation name of the remote (key in mfe-manifest.json `remotes`). */
  name: string;
  /** Exposed module. Default `./App`. */
  module?: string;
  /**
   * Where the remote is mounted. Default: derived from the current route (the part of the URL
   * before the splat `*`), `/` outside a router.
   */
  basePath?: string;
  /** Extra props (e.g. `user`). Merged over the manifest's per-remote `props`. */
  props?: Record<string, unknown>;
  /** Automatic retries after a failed load, before showing the fallback. Default 1. */
  retries?: number;
  /** Shown while the remote loads. */
  loading?: ReactNode;
  /** Called when the remote fails to load or throws while rendering. */
  onError?: (error: Error, info: { name: string; module: string }) => void;
};

type RemoteModule = { default?: ComponentType<HostProps> } & Record<
  string,
  unknown
>;

const RETRY_DELAY_MS = 300;

function shortMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const firstLine = message.split('\n')[0]?.trim() ?? '';
  return firstLine.length > 200 ? `${firstLine.slice(0, 200)}…` : firstLine;
}

async function loadRemoteComponent(
  id: string,
  attempts: number,
  reset: (() => void) | undefined,
): Promise<{ default: ComponentType<HostProps> }> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) {
      reset?.();
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
    }
    try {
      const mod = await loadRemote<RemoteModule>(id);
      if (!mod) throw new Error(`Remote module "${id}" resolved to nothing.`);
      const component =
        mod.default ??
        (typeof mod === 'function' ? (mod as ComponentType<HostProps>) : null);
      if (typeof component !== 'function') {
        throw new Error(
          `Remote module "${id}" has no default export component.`,
        );
      }
      return { default: component };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

type BoundaryProps = {
  name: string;
  module: string;
  onRetry: () => void;
  onError?: RemoteAppProps['onError'];
  children: ReactNode;
};

type BoundaryState = { error: Error | null };

class RemoteErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const { name, module, onError } = this.props;
    console.error(
      `[mf-runtime] remote "${name}" (${module}) failed:`,
      error,
      info.componentStack,
    );
    onError?.(error, { name, module });
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <RemoteFallback
          reason={`${this.props.name}: ${shortMessage(error) || 'The remote module is unreachable or failed to load.'}`}
          onRetry={this.props.onRetry}
        />
      );
    }
    return this.props.children;
  }
}

/** Base path from the router: the matched URL before the splat (`/apps/x/route-1` → `/apps/x`). */
function useRouteBasePath(): string {
  const location = useLocation();
  const params = useParams();
  const splat = params['*'] ?? '';
  const pathname = location.pathname;
  const base =
    splat && pathname.endsWith(splat)
      ? pathname.slice(0, pathname.length - splat.length)
      : pathname;
  return normalizeBasePath(base);
}

function RouterBasePath({
  children,
}: {
  children: (basePath: string) => ReactNode;
}) {
  return <>{children(useRouteBasePath())}</>;
}

/**
 * Render a federated remote registered from the manifest.
 *
 * Suspense + error boundary + `RemoteFallback` (with retry). A failing remote never takes the
 * shell down. The remote receives `HostProps`: `{ embedded: true, basePath, settings, user?,
 * ...manifest props, ...props }`.
 */
export function RemoteApp({
  name,
  module = './App',
  basePath,
  props,
  retries = 1,
  loading,
  onError,
}: RemoteAppProps) {
  const manifest = useMfeManifest();
  const inRouter = useInRouterContext();
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  const entry = manifest?.remotes[name]?.entry;

  // Created here, above the Suspense boundary: a component that suspends before its first
  // commit loses its hook state, so a lazy() created below Suspense would load again on retry.
  const Remote = useMemo(() => {
    const id = `${name}/${module.replace(/^\.\//, '')}`;
    const reset = entry
      ? () => resetRemote({ name, entry: resolveRemoteEntry(entry) })
      : undefined;
    return lazy(() => {
      // a manual retry after a failure starts from a fresh registration
      if (attempt > 0) reset?.();
      return loadRemoteComponent(id, retries + 1, reset);
    });
  }, [name, module, entry, attempt, retries]);

  if (manifest && !manifest.remotes[name]) {
    return (
      <RemoteFallback
        reason={`Remote "${name}" is not configured in mfe-manifest.json.`}
      />
    );
  }

  const render = (resolvedBase: string) => {
    const hostProps: HostProps = {
      settings: manifest?.settings ?? {},
      ...(manifest?.remotes[name]?.props ?? {}),
      ...props,
      // authoritative, cannot be overridden by manifest or shell props
      embedded: true,
      basePath: resolvedBase,
    };
    return (
      <RemoteErrorBoundary
        key={attempt}
        name={name}
        module={module}
        onRetry={retry}
        onError={onError}
      >
        <Suspense
          fallback={
            loading ?? (
              <div
                role="status"
                aria-live="polite"
                data-testid="remote-loading"
              >
                Loading {name}…
              </div>
            )
          }
        >
          <Remote {...hostProps} />
        </Suspense>
      </RemoteErrorBoundary>
    );
  };

  if (basePath !== undefined || !inRouter) {
    return render(normalizeBasePath(basePath));
  }
  return <RouterBasePath>{render}</RouterBasePath>;
}
