/**
 * The profile feature's query keys, general to specific. One place, so a mutation invalidates
 * exactly what the queries use (docs/coding-conventions.md "Data fetching").
 */
export const profileKeys = {
  all: ['profile'] as const,
  me: () => [...profileKeys.all, 'me'] as const,
};
