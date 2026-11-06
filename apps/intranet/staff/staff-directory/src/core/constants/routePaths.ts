/** Relative route segments of this remote. Use with useRemotePath() for links. */
export const routePaths = {
  list: '',
  /** Route pattern of a staff member's page. */
  detail: ':staffId',
} as const;

/** Relative path of one staff member's page (pass to useRemotePath()). */
export function staffPath(id: string): string {
  return encodeURIComponent(id);
}
