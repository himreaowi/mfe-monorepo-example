/**
 * Props a shell passes to a remote's exposed component (the host → remote contract).
 * Ported from starter-mfe HostPropsContext / remote-host-props contract.
 * Additive optional props = minor change; removing or renaming one = breaking.
 */

/** Signed-in user as seen by remotes. Refined by @org/auth (A6). */
export type HostUser = {
  id: string;
  name?: string;
  [key: string]: unknown;
};

export type HostProps = {
  /** `true` when rendered by a shell, `false` when the remote runs standalone. */
  embedded: boolean;
  /**
   * Absolute URL path where the shell mounted the remote (e.g. `/apps/staff`), `/` standalone.
   * The remote's routes are relative to it; use `useRemotePath()` for absolute links.
   */
  basePath: string;
  /** Current user, `null` when signed out, `undefined` when the shell has no auth. */
  user?: HostUser | null;
  /** `settings` from mfe-manifest.json (e.g. `apiBaseUrl`). */
  settings?: Record<string, unknown>;
  /** Per-remote `props` from mfe-manifest.json and props set by the shell. */
  [key: string]: unknown;
};

/** Normalise a base path: leading slash, no trailing slash (except `/`). */
export function normalizeBasePath(basePath: string | undefined): string {
  if (!basePath) return '/';
  const withLeading = basePath.startsWith('/') ? basePath : `/${basePath}`;
  const trimmed = withLeading.replace(/\/+$/, '');
  return trimmed || '/';
}

/** Join a base path and a relative path. `joinBasePath('/apps/x', 'route-2')` → `/apps/x/route-2`. */
export function joinBasePath(basePath: string, to: string): string {
  const base = normalizeBasePath(basePath);
  const rel = to.replace(/^\/+/, '');
  if (!rel) return base;
  return base === '/' ? `/${rel}` : `${base}/${rel}`;
}
