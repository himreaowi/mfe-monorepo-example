/**
 * The announcements' query keys, general to specific. One place, so a mutation (none yet)
 * invalidates exactly what the queries use (docs/coding-conventions.md "Data fetching").
 */
export const announcementKeys = {
  all: ['announcements'] as const,
  list: () => [...announcementKeys.all, 'list'] as const,
  detail: (id: string) => [...announcementKeys.all, 'detail', id] as const,
};
