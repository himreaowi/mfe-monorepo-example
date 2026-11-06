/**
 * External module mount contract.
 *
 * The contract between a host page (our portals' shells) and an external/vendor module that is
 * built elsewhere, with any framework (or none). Framework-free on purpose: this file has no
 * imports. Host side: docs/external-modules.md. Vendors get it as `mount-contract.d.ts` in the
 * vendor kit (with README.md and CHECKLIST.md).
 *
 * Versioning: `MAJOR.MINOR.PATCH`. A module declares the version it implements in
 * `contractVersion`; the host accepts the same MAJOR. Adding an optional prop or callback is a
 * MINOR change; removing/renaming anything or changing behaviour is a MAJOR change.
 *
 * Delivery formats (all expose the same `mount`):
 * - `esm`: an ES module with named exports `contractVersion` and `mount` (or a default export
 *   object with both).
 * - `script`: a classic script that sets ONE namespaced global (e.g. `window.AcmePayments`)
 *   to `{ contractVersion, mount }`. Legacy option.
 * - `web-component`: a script that defines a custom element whose class has a static
 *   `contractVersion`. The host sets `element.props` (a `MountProps`) and updates it; the
 *   element may call the callbacks in `props` or dispatch the `EXTERNAL_EVENTS`.
 * - `mf`: a Module Federation remote exposing `./mount` with the exports of `esm`. It must not
 *   share anything with the host (no `shared` config).
 */

/** Contract version implemented by this host. */
export const MOUNT_CONTRACT_VERSION = '1.0.0';

export type ExternalTheme = 'light' | 'dark';

/** The signed-in user, PDPA-minimal (same fields as the host's user). */
export interface ExternalUser {
  /** Opaque id. Never an NRIC/FIN. */
  id: string;
  name?: string;
  roles?: string[];
}

/** An error the module reports to the host through `onError`. */
export interface ExternalModuleError {
  /** Short machine-readable code, e.g. `payment-declined`, `api-unavailable`. */
  code: string;
  /** Human-readable message (no personal data). */
  message: string;
  /**
   * `true`: the module cannot continue. The host unmounts it and shows its fallback panel with
   * "Try again". `false`/missing: the host only logs/reports it.
   */
  fatal?: boolean;
  /** Extra data for logs (no personal data). */
  detail?: unknown;
}

export interface ExternalNavigateOptions {
  /** Replace the current history entry instead of pushing one. */
  replace?: boolean;
}

/** Props the host passes to `mount()` and `update()`. Treat them as read-only. */
export interface MountProps {
  /** Contract version the host implements (`MOUNT_CONTRACT_VERSION`). */
  contractVersion: string;
  /** Absolute URL path where the host mounted the module, e.g. `/payments`. */
  basePath: string;
  /**
   * Current path below `basePath` without a leading slash, `''` at the module's root
   * (`/payments/receipts/7` → `receipts/7`). Changes arrive through `update()`; use it for
   * the module's own routing instead of reading or changing `window.location`.
   */
  path: string;
  /** Current colour theme of the host. CSS custom properties of the host are also inherited. */
  theme: ExternalTheme;
  /** BCP 47 language tag, e.g. `en-SG`. */
  locale: string;
  /** Signed-in user, `null` when signed out. */
  user: ExternalUser | null;
  /** Module-specific configuration from the host's runtime manifest (per environment). */
  config: Readonly<Record<string, unknown>>;
  /**
   * Ask the host to navigate. Relative paths (`receipts/7`) are below `basePath`; absolute
   * paths (`/services`) are host routes. The host updates `path` via `update()`.
   */
  onNavigate(to: string, options?: ExternalNavigateOptions): void;
  /** Business/analytics event for the host, e.g. `onEvent('payment:completed', { ref })`. */
  onEvent(name: string, detail?: unknown): void;
  /** Report an error. `fatal: true` makes the host show its fallback. */
  onError(error: ExternalModuleError): void;
}

/** What `mount()` returns. */
export interface MountedModule {
  /** New props (theme, path, user, config changed). Missing → the host remounts instead. */
  update?(props: MountProps): void;
  /** Remove everything the module added (DOM, listeners, timers, global state). */
  unmount(): void | Promise<void>;
}

/**
 * Render the module into `element` (an empty element owned by the host). May be async. Must
 * not touch anything outside `element` (no global CSS, no `document.body` changes).
 */
export type MountFunction = (
  element: HTMLElement,
  props: MountProps,
) => MountedModule | Promise<MountedModule>;

/** Exports of an `esm`/`mf` module, or the value of the `script` global. */
export interface ExternalModuleExports {
  /** Contract version the module implements, e.g. `'1.0.0'`. */
  contractVersion: string;
  mount: MountFunction;
}

/** A `web-component` module's element. The host assigns `props` (and re-assigns on update). */
export interface ExternalModuleElement extends HTMLElement {
  props?: MountProps;
}

/**
 * Optional for `web-component` modules: instead of calling the callbacks in `props`, the
 * element may dispatch these `CustomEvent`s (with `bubbles: true, composed: true`).
 * `detail`: navigate `{ to, replace? }`, event `{ name, detail? }`, error `ExternalModuleError`.
 */
export const EXTERNAL_EVENTS = {
  navigate: 'external:navigate',
  event: 'external:event',
  error: 'external:error',
} as const;

/** `true` when a module's `contractVersion` has the same MAJOR as the host's. */
export function isCompatibleContractVersion(
  moduleVersion: unknown,
  hostVersion: string = MOUNT_CONTRACT_VERSION,
): boolean {
  if (typeof moduleVersion !== 'string') return false;
  const major = (v: string) => /^(\d+)(?:\.\d+){0,2}$/.exec(v.trim())?.[1];
  const m = major(moduleVersion);
  return m !== undefined && m === major(hostVersion);
}
