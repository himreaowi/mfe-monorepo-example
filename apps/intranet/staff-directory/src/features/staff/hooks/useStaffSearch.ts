import { useCallback } from 'react';
import { requireApiClient, useApi } from '@org/use-api';
import { useApiClient } from '@org/mf-runtime/remote';
import { searchStaff } from '../api';
import type { StaffSearchQuery } from '../types/staff';

export function useStaffSearch({ q, department }: StaffSearchQuery) {
  const http = useApiClient();
  const load = useCallback(
    async (signal: AbortSignal) =>
      searchStaff(requireApiClient(http), { q, department }, signal),
    [http, q, department],
  );
  return useApi(load);
}
