import type { StaffSearchQuery } from './types/staff';

/**
 * The staff directory's query keys, general to specific. The filters are part of the key, so a
 * new search loads new data and the same search again comes from the cache. Exported for the
 * apps that load staff data with their own hooks (one cache per remote, same keys).
 */
export const staffKeys = {
  all: ['staff'] as const,
  search: ({ q, department }: StaffSearchQuery) =>
    [...staffKeys.all, 'search', { q, department }] as const,
  departments: () => [...staffKeys.all, 'departments'] as const,
  detail: (id: string) => [...staffKeys.all, 'detail', id] as const,
};
