/**
 * Framework-free loaders for external modules (esm, script, web-component; mf via an injected
 * loader). Used by `<ExternalModule>` and, compiled to plain JS, by the @org/vendor-kit test host,
 * so vendors test against the same loading code the shells run.
 */
import type { ExternalModuleConfig } from './config';
import {
  EXTERNAL_EVENTS,
  MOUNT_CONTRACT_VERSION,
  isCompatibleContractVersion,
  type ExternalModuleElement,
  type ExternalModuleExports,
  type MountFunction,
  type MountProps,
} from './contract';

export type ExternalErrorCode =
  | 'invalid-config'
  | 'load-failed'
  | 'timeout'
  | 'invalid-module'
  | 'incompatible-contract'
  | 'mount-failed'
  | 'update-failed'
  | 'unmount-failed'
  | 'vendor-error';

export class ExternalModuleLoadError extends Error {
  readonly code: ExternalErrorCode;

  constructor(code: ExternalErrorCode, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'ExternalModuleLoadError';
    this.code = code;
  }
}

export const DEFAULT_EXTERNAL_TIMEOUT_MS = 15_000;

/**
 * Reject after `ms`. If the original promise settles later with a value, `onLate` gets it
 * (e.g. to unmount a module whose mount() finished after the timeout).
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  what: string,
  onLate?: (value: T) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      reject(
        new ExternalModuleLoadError(
          'timeout',
          `${what} timed out after ${ms} ms`,
        ),
      );
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        if (timedOut) onLate?.(value);
        else resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        if (!timedOut) reject(error);
      },
    );
  });
}

export type LoadExternalModuleOptions = {
  /** Native dynamic import. Override in tests. */
  importModule?: (url: string) => Promise<unknown>;
  /** Loader for format `mf` (needs the Module Federation runtime; `<ExternalModule>` passes it). */
  loadMf?: (config: ExternalModuleConfig) => Promise<unknown>;
  /** Retry attempt (> 0 adds a cache-busting query parameter so a failed URL is fetched again). */
  attempt?: number;
  document?: Document;
};

// `webpackIgnore`: the bundler must leave this import() alone; the browser loads the vendor URL.
const nativeImport = (url: string): Promise<unknown> =>
  import(/* webpackIgnore: true */ /* @vite-ignore */ url);

function absolute(url: string, doc: Document): string {
  return new URL(url, doc.baseURI).toString();
}

function withAttempt(url: string, attempt: number | undefined): string {
  if (!attempt) return url;
  const u = new URL(url);
  u.searchParams.set('mfeRetry', String(attempt));
  return u.toString();
}

const scriptCache = new Map<string, Promise<void>>();

function loadScript(
  doc: Document,
  url: string,
  options: {
    type: 'module' | 'classic';
    integrity?: string;
    crossOrigin: string;
  },
): Promise<void> {
  const key = `${options.type}:${url}`;
  const cached = scriptCache.get(key);
  if (cached) return cached;
  const promise = new Promise<void>((resolve, reject) => {
    const script = doc.createElement('script');
    if (options.type === 'module') script.type = 'module';
    script.src = url;
    script.async = true;
    script.crossOrigin = options.crossOrigin;
    if (options.integrity) script.integrity = options.integrity;
    script.dataset.externalModule = url;
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      reject(
        new ExternalModuleLoadError(
          'load-failed',
          `Could not load ${url} (network error, CORS, CSP or integrity mismatch).`,
        ),
      );
    };
    doc.head.appendChild(script);
  });
  scriptCache.set(key, promise);
  promise.catch(() => scriptCache.delete(key));
  return promise;
}

/** `<link rel="modulepreload" integrity>`: the import() that follows reuses the verified module. */
function preloadModule(
  doc: Document,
  url: string,
  integrity: string,
  crossOrigin: string,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const link = doc.createElement('link');
    link.rel = 'modulepreload';
    link.href = url;
    link.integrity = integrity;
    link.crossOrigin = crossOrigin;
    link.onload = () => resolve();
    link.onerror = () => {
      link.remove();
      reject(
        new ExternalModuleLoadError(
          'load-failed',
          `Could not load ${url} (network error, CORS, CSP or integrity mismatch).`,
        ),
      );
    };
    doc.head.appendChild(link);
  });
}

function readGlobal(path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (obj, key) =>
        obj && typeof obj === 'object'
          ? (obj as Record<string, unknown>)[key]
          : undefined,
      globalThis,
    );
}

/** Check and normalise `{ contractVersion, mount }` (accepts a `default` export holding them). */
export function toExternalModule(
  value: unknown,
  what: string,
): ExternalModuleExports {
  let candidate = value as Partial<ExternalModuleExports> & {
    default?: Partial<ExternalModuleExports>;
  };
  if (
    candidate &&
    typeof candidate.mount !== 'function' &&
    candidate.default &&
    typeof candidate.default.mount === 'function'
  ) {
    candidate = candidate.default;
  }
  if (!candidate || typeof candidate.mount !== 'function') {
    throw new ExternalModuleLoadError(
      'invalid-module',
      `${what} does not provide mount(element, props).`,
    );
  }
  if (!isCompatibleContractVersion(candidate.contractVersion)) {
    throw new ExternalModuleLoadError(
      'incompatible-contract',
      `${what} implements mount contract ${String(candidate.contractVersion ?? '(none)')}; this host implements ${MOUNT_CONTRACT_VERSION} (the major version must match).`,
    );
  }
  const module = candidate as ExternalModuleExports;
  return {
    contractVersion: module.contractVersion,
    mount: (element, props) => module.mount(element, props),
  };
}

/** Mount function for a `web-component` module: one element per mount, `props` property. */
export function webComponentMount(
  tagName: string,
  doc: Document = document,
): MountFunction {
  return (element, props) => {
    const node = doc.createElement(tagName) as ExternalModuleElement;
    let current: MountProps = props;
    const detail = (e: Event) =>
      ((e as CustomEvent).detail ?? {}) as Record<string, unknown>;
    const listeners: [string, (e: Event) => void][] = [
      [
        EXTERNAL_EVENTS.navigate,
        (e) => {
          const d = detail(e);
          current.onNavigate(String(d.to ?? ''), {
            replace: d.replace === true,
          });
        },
      ],
      [
        EXTERNAL_EVENTS.event,
        (e) => {
          const d = detail(e);
          current.onEvent(String(d.name ?? 'event'), d.detail);
        },
      ],
      [
        EXTERNAL_EVENTS.error,
        (e) => {
          const d = detail(e);
          current.onError({
            code: String(d.code ?? 'vendor-error'),
            message: String(d.message ?? 'Unknown error'),
            fatal: d.fatal === true,
            detail: d.detail,
          });
        },
      ],
    ];
    for (const [type, fn] of listeners) node.addEventListener(type, fn);
    node.props = props;
    element.appendChild(node);
    return {
      update(next) {
        current = next;
        node.props = next;
      },
      unmount() {
        for (const [type, fn] of listeners) node.removeEventListener(type, fn);
        node.remove();
      },
    };
  };
}

/**
 * Load an external module and return its normalised `{ contractVersion, mount }`.
 * Throws `ExternalModuleLoadError` (`load-failed`, `invalid-module`, `incompatible-contract`,
 * `invalid-config`). No timeout here: wrap with `withTimeout`.
 */
export async function loadExternalModule(
  config: ExternalModuleConfig,
  options: LoadExternalModuleOptions = {},
): Promise<ExternalModuleExports> {
  const doc = options.document ?? document;
  const crossOrigin = config.crossOrigin ?? 'anonymous';
  const url = withAttempt(absolute(config.url, doc), options.attempt);
  const what = `External module ${config.url}`;

  switch (config.format) {
    case 'esm': {
      const importModule = options.importModule ?? nativeImport;
      if (config.integrity) {
        await preloadModule(doc, url, config.integrity, crossOrigin);
      }
      let mod: unknown;
      try {
        mod = await importModule(url);
      } catch (error) {
        throw new ExternalModuleLoadError(
          'load-failed',
          `Could not load ${url}: ${error instanceof Error ? error.message : String(error)}`,
          error,
        );
      }
      const value = config.exportName
        ? (mod as Record<string, unknown>)?.[config.exportName]
        : mod;
      return toExternalModule(value, what);
    }
    case 'script': {
      if (!config.global) {
        throw new ExternalModuleLoadError(
          'invalid-config',
          'format "script" needs "global".',
        );
      }
      if (readGlobal(config.global) === undefined) {
        await loadScript(doc, url, {
          type: 'classic',
          integrity: config.integrity,
          crossOrigin,
        });
      }
      const value = readGlobal(config.global);
      if (value === undefined) {
        throw new ExternalModuleLoadError(
          'invalid-module',
          `${what} loaded but did not set window.${config.global}.`,
        );
      }
      return toExternalModule(value, what);
    }
    case 'web-component': {
      const tag = config.tagName;
      if (!tag) {
        throw new ExternalModuleLoadError(
          'invalid-config',
          'format "web-component" needs "tagName".',
        );
      }
      const registry = doc.defaultView?.customElements ?? customElements;
      if (!registry.get(tag)) {
        await loadScript(doc, url, {
          type: config.scriptType ?? 'module',
          integrity: config.integrity,
          crossOrigin,
        });
        await registry.whenDefined(tag);
      }
      const ctor = registry.get(tag) as
        (CustomElementConstructor & { contractVersion?: unknown }) | undefined;
      return toExternalModule(
        {
          contractVersion: ctor?.contractVersion,
          mount: webComponentMount(tag, doc),
        },
        `${what} (<${tag}>)`,
      );
    }
    case 'mf': {
      if (!options.loadMf) {
        throw new ExternalModuleLoadError(
          'invalid-config',
          'format "mf" needs the Module Federation runtime (use <ExternalModule> from @org/mf-runtime/external).',
        );
      }
      let mod: unknown;
      try {
        mod = await options.loadMf({ ...config, url });
      } catch (error) {
        throw new ExternalModuleLoadError(
          'load-failed',
          `Could not load Module Federation remote ${config.remoteName} from ${url}: ${error instanceof Error ? error.message : String(error)}`,
          error,
        );
      }
      return toExternalModule(mod, what);
    }
    default:
      throw new ExternalModuleLoadError(
        'invalid-config',
        `Unknown format "${String((config as { format?: unknown }).format)}".`,
      );
  }
}
