/**
 * The leave feature's query keys, general to specific: `leaveKeys.all` reaches everything of
 * this feature, the others one query. One place, so a mutation invalidates exactly what the
 * queries use (docs/coding-conventions.md "Data fetching").
 */
export const leaveKeys = {
  all: ['leave'] as const,
  balance: () => [...leaveKeys.all, 'balance'] as const,
  requests: () => [...leaveKeys.all, 'requests'] as const,
};
