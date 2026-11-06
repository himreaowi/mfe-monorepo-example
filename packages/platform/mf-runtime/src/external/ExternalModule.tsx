import {
  Component,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { RemoteFallback } from '@org/ui';
import {
  validateExternalModuleConfig,
  type ExternalModuleConfig,
} from './config';
import {
  MOUNT_CONTRACT_VERSION,
  type ExternalModuleError,
  type ExternalModuleExports,
  type ExternalNavigateOptions,
  type ExternalTheme,
  type ExternalUser,
  type MountedModule,
  type MountProps,
} from './contract';
import {
  DEFAULT_EXTERNAL_TIMEOUT_MS,
  ExternalModuleLoadError,
  loadExternalModule,
  withTimeout,
} from './load';
import { loadMfExternalModule } from './loadMf';

/** Every error `<ExternalModule>` reports: host-side failures and errors the module reported. */
export type ExternalModuleReportedError = ExternalModuleError & {
  /** `host`: loading/mounting failed; `module`: the module called `onError`. */
  source: 'host' | 'module';
};

export type ExternalModuleLoader = (
  config: ExternalModuleConfig,
  options: { attempt: number },
) => Promise<ExternalModuleExports>;

export type ExternalModuleProps = {
  /** Label for messages and logs, e.g. the adapter's federation name. */
  name: string;
  /** Where/how to load the module (validated; an invalid config shows the fallback). */
  config: unknown;
  /** Absolute path where the module is mounted. Default `/`. */
  basePath?: string;
  /** Current path below `basePath` (no leading slash). Default `''`. */
  path?: string;
  /** Default `light`. */
  theme?: ExternalTheme;
  /** Default `navigator.language` or `en`. */
  locale?: string;
  user?: ExternalUser | null;
  /** The module asked to navigate (relative to `basePath`, or an absolute host path). */
  onNavigate?: (to: string, options?: ExternalNavigateOptions) => void;
  /** Business/analytics event from the module. */
  onEvent?: (name: string, detail?: unknown) => void;
  /** Load/mount failures and errors the module reported. */
  onError?: (error: ExternalModuleReportedError) => void;
  /** Shown while loading. */
  loading?: ReactNode;
  className?: string;
  /** Replace the loader (tests). Default: `loadExternalModule` (+ MF runtime for `mf`). */
  load?: ExternalModuleLoader;
};

const defaultLoad: ExternalModuleLoader = (config, { attempt }) =>
  loadExternalModule(config, { attempt, loadMf: loadMfExternalModule });

function toModuleError(value: unknown): ExternalModuleError {
  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>;
    return {
      code: typeof v.code === 'string' ? v.code : 'vendor-error',
      message:
        typeof v.message === 'string'
          ? v.message
          : 'The module reported an error.',
      fatal: v.fatal === true,
      detail: v.detail,
    };
  }
  return { code: 'vendor-error', message: String(value), fatal: false };
}

function toHostError(error: unknown): ExternalModuleReportedError {
  if (error instanceof ExternalModuleLoadError) {
    return {
      code: error.code,
      message: error.message,
      fatal: true,
      source: 'host',
    };
  }
  return {
    code: 'mount-failed',
    message: error instanceof Error ? error.message : String(error),
    fatal: true,
    source: 'host',
  };
}

type MountHostProps = {
  name: string;
  config: ExternalModuleConfig;
  attempt: number;
  mountProps: MountProps;
  load: ExternalModuleLoader;
  loading?: ReactNode;
  onFailure: (error: ExternalModuleReportedError) => void;
  onNeedsRemount: () => void;
};

/** One mount lifecycle (keyed by config + attempt): load → mount → update* → unmount. */
function MountHost({
  name,
  config,
  attempt,
  mountProps,
  load,
  loading,
  onFailure,
  onNeedsRemount,
}: MountHostProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<MountedModule | null>(null);
  const sentRef = useRef<MountProps | null>(null);
  const [mounted, setMounted] = useState(false);
  // latest values for the async mount without re-running the effect
  const latest = useRef({ mountProps, load, onFailure });
  useLayoutEffect(() => {
    latest.current = { mountProps, load, onFailure };
  });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    let active = true;
    let handle: MountedModule | null = null;
    const timeout = config.timeoutMs ?? DEFAULT_EXTERNAL_TIMEOUT_MS;
    const report = (error: unknown, code: 'unmount-failed') =>
      latest.current.onFailure({
        code,
        message: error instanceof Error ? error.message : String(error),
        fatal: false,
        source: 'host',
      });
    const unmountQuietly = (h: MountedModule | null | undefined) => {
      if (!h || typeof h.unmount !== 'function') return;
      try {
        void Promise.resolve(h.unmount()).catch((e) =>
          report(e, 'unmount-failed'),
        );
      } catch (e) {
        report(e, 'unmount-failed');
      }
    };

    void (async () => {
      try {
        const mod = await withTimeout(
          latest.current.load(config, { attempt }),
          timeout,
          `Loading ${name}`,
        );
        if (!active) return;
        const props = latest.current.mountProps;
        const h = await withTimeout(
          Promise.resolve().then(() => mod.mount(element, props)),
          timeout,
          `Mounting ${name}`,
          unmountQuietly,
        );
        if (!h || typeof h.unmount !== 'function') {
          throw new ExternalModuleLoadError(
            'invalid-module',
            `${name}: mount() must return { unmount(), update?() }.`,
          );
        }
        if (!active) {
          unmountQuietly(h);
          return;
        }
        handle = h;
        handleRef.current = h;
        sentRef.current = props;
        setMounted(true);
      } catch (error) {
        if (active) latest.current.onFailure(toHostError(error));
      }
    })();

    return () => {
      active = false;
      handleRef.current = null;
      unmountQuietly(handle);
    };
  }, [config, attempt, name]);

  // prop changes → update() (or a remount when the module has no update)
  useEffect(() => {
    const h = handleRef.current;
    if (!mounted || !h || sentRef.current === mountProps) return;
    sentRef.current = mountProps;
    if (typeof h.update !== 'function') {
      onNeedsRemount();
      return;
    }
    try {
      h.update(mountProps);
    } catch (error) {
      onFailure({
        code: 'update-failed',
        message: error instanceof Error ? error.message : String(error),
        fatal: true,
        source: 'host',
      });
    }
  }, [mountProps, mounted, onFailure, onNeedsRemount]);

  return (
    <>
      {mounted
        ? null
        : (loading ?? (
            <div
              role="status"
              aria-live="polite"
              data-testid="external-module-loading"
            >
              Loading {name}…
            </div>
          ))}
      {/* Owned by the module: React never renders children into it. */}
      <div
        ref={containerRef}
        data-testid="external-module-root"
        data-external-module={name}
      />
    </>
  );
}

type BoundaryProps = {
  onError: (error: Error) => void;
  children: ReactNode;
};

class Boundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      '[mf-runtime] external module crashed:',
      error,
      info.componentStack,
    );
    this.props.onError(error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Mount an external/vendor module through the mount contract (`mount(el, props) →
 * { update?, unmount }`, docs/external-modules.md).
 *
 * - loads the bundle (`esm`, `script`, `web-component` or `mf`) with a timeout
 * - checks `contractVersion` (same major as `MOUNT_CONTRACT_VERSION`)
 * - mounts into its own `<div>`, passes props + callbacks, calls `update()` on prop changes,
 *   `unmount()` when it leaves (route change) or before a retry
 * - any failure (invalid config, network, timeout, bad module, throwing mount, fatal error
 *   reported by the module) → `RemoteFallback` with "Try again"; the page keeps working
 */
export function ExternalModule({
  name,
  config,
  basePath = '/',
  path = '',
  theme = 'light',
  locale,
  user = null,
  onNavigate,
  onEvent,
  onError,
  loading,
  className,
  load = defaultLoad,
}: ExternalModuleProps) {
  const configKey = JSON.stringify(config ?? null);
  // keyed by the serialized config: a new object with the same content is the same config
  const validation = useMemo(
    () => validateExternalModuleConfig(JSON.parse(configKey)),
    [configKey],
  );
  const [attempt, setAttempt] = useState(0);
  const [generation, setGeneration] = useState(0);
  const [failure, setFailure] = useState<ExternalModuleReportedError | null>(
    null,
  );

  const callbacks = useRef({ onNavigate, onEvent, onError });
  useLayoutEffect(() => {
    callbacks.current = { onNavigate, onEvent, onError };
  });

  const fail = useCallback(
    (error: ExternalModuleReportedError) => {
      callbacks.current.onError?.(error);
      if (error.fatal) {
        console.error(
          `[mf-runtime] external module "${name}" failed: ${error.message}`,
        );
        setFailure(error);
      }
    },
    [name],
  );

  // Stable functions handed to the module; they call the latest host callbacks.
  const moduleCallbacks = useMemo(
    () => ({
      onNavigate: (to: string, options?: ExternalNavigateOptions) =>
        callbacks.current.onNavigate?.(String(to), options),
      onEvent: (eventName: string, detail?: unknown) =>
        callbacks.current.onEvent?.(String(eventName), detail),
      onError: (error: ExternalModuleError) =>
        fail({ ...toModuleError(error), source: 'module' }),
    }),
    [fail],
  );

  const userKey = JSON.stringify(user ?? null);
  const resolvedLocale =
    locale ||
    (typeof navigator !== 'undefined' ? navigator.language : '') ||
    'en';
  const moduleConfig = validation.ok ? validation.config.config : undefined;
  const mountProps = useMemo<MountProps>(
    () => ({
      contractVersion: MOUNT_CONTRACT_VERSION,
      basePath,
      path: path.replace(/^\/+/, ''),
      theme,
      locale: resolvedLocale,
      user: JSON.parse(userKey) as ExternalUser | null,
      config: Object.freeze({ ...(moduleConfig ?? {}) }),
      ...moduleCallbacks,
    }),
    [
      basePath,
      path,
      theme,
      resolvedLocale,
      userKey,
      moduleConfig,
      moduleCallbacks,
    ],
  );

  const invalidReported = useRef<string | null>(null);
  useEffect(() => {
    if (validation.ok || invalidReported.current === configKey) return;
    invalidReported.current = configKey;
    callbacks.current.onError?.({
      code: 'invalid-config',
      message: `Invalid external module config: ${validation.issues.join('; ')}`,
      fatal: true,
      source: 'host',
    });
  }, [validation, configKey]);

  const retry = useCallback(() => {
    setFailure(null);
    setAttempt((a) => a + 1);
  }, []);
  const remount = useCallback(() => setGeneration((g) => g + 1), []);

  let content: ReactNode;
  if (!validation.ok) {
    content = (
      <RemoteFallback
        title="Module not configured"
        reason={`${name}: invalid external module config (${validation.issues.join('; ')}).`}
      />
    );
  } else if (failure) {
    content = (
      <RemoteFallback
        title="Module unavailable"
        reason={`${name}: ${failure.message}`}
        onRetry={retry}
      />
    );
  } else {
    content = (
      <Boundary
        onError={(error) =>
          fail({
            code: 'mount-failed',
            message: error.message,
            fatal: true,
            source: 'host',
          })
        }
      >
        <MountHost
          key={`${configKey}:${attempt}:${generation}`}
          name={name}
          config={validation.config}
          attempt={attempt}
          mountProps={mountProps}
          load={load}
          loading={loading}
          onFailure={fail}
          onNeedsRemount={remount}
        />
      </Boundary>
    );
  }
  return (
    <div className={className} data-testid="external-module" data-name={name}>
      {content}
    </div>
  );
}
