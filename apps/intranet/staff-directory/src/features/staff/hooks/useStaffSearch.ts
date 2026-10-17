import { useCallback } from 'react';
import { useApi } from '@org/use-api';
import { useApiClient } from '@/services/http';
import { searchStaff } from '../api';
import type { StaffSearchQuery } from '../types/staff';

export function useStaffSearch({ q, department }: StaffSearchQuery) {
  const http = useApiClient();
  const load = useCallback(
    (signal: AbortSignal) => searchStaff(http, { q, department }, signal),
    [http, q, department],
  );
  return useApi(load);
}
