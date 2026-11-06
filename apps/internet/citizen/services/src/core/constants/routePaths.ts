/** Relative route segments of this remote. Use with useRemotePath() for links. */
export const routePaths = {
  catalogue: '',
  /** Route pattern of one service's page. */
  service: ':slug',
} as const;

/** Relative path of one service's page (pass to useRemotePath()). */
export function servicePath(slug: string): string {
  return encodeURIComponent(slug);
}
