/** Relative route segments of this remote. Use with useRemotePath() for links. */
export const routePaths = {
  list: '',
  /** Route pattern of one announcement. */
  announcement: ':announcementId',
} as const;

/** Relative path of one announcement (pass to useRemotePath()). */
export function announcementPath(id: string): string {
  return encodeURIComponent(id);
}
