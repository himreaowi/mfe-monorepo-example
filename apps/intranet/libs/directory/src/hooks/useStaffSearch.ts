import { useCallback } from 'react';
import { requireApiClient, useApi } from '@org/use-api';
import { useApiClient } from '@org/mf-runtime/remote';
import { searchStaff } from '../api/staffApi';
import type { StaffSearchQuery } from '../types/staff';

/**
 * Search the staff API. Pass `{ enabled: false }` to wait (no request; the result stays
 * `loading`), e.g. until the user typed something.
 */
export function useStaffSearch(
  { q, department }: StaffSearchQuery,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const http = useApiClient();
  const load = useCallback(
    async (signal: AbortSignal) =>
      searchStaff(requireApiClient(http), { q, department }, signal),
    [http, q, department],
  );
  return useApi(enabled ? load : null);
}
