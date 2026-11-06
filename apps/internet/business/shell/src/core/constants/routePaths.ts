import type { RemoteEntry } from '@/core/types/remotes';

/** Shell route paths. Do not hardcode them in components. */
export const routePaths = {
  home: '/',
} as const;

/** Route path that mounts a remote: `/staff` → `staff/*` (the remote owns everything below). */
export function remoteMountPath(remote: Pick<RemoteEntry, 'path'>): string {
  return `${remote.path.replace(/^\/+|\/+$/g, '')}/*`;
}
