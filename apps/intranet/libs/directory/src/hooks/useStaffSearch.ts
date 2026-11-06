import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { requireApiClient } from '@org/http-client';
import { useApiClient } from '@org/mf-runtime/remote';
import { searchStaff } from '../api/staffApi';
import { staffKeys } from '../queryKeys';
import type { StaffSearchQuery } from '../types/staff';

/**
 * Search the staff API as a query result. The filters are part of the key; the previous list
 * stays (`placeholderData`) while a new search loads. Pass `{ enabled: false }` to wait (no
 * request; `status` stays `pending`), e.g. until the user typed something.
 */
export function useStaffSearch(
  { q, department }: StaffSearchQuery,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const http = useApiClient();
  return useQuery({
    queryKey: staffKeys.search({ q, department }),
    queryFn: ({ signal }) =>
      searchStaff(requireApiClient(http), { q, department }, signal),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export type StaffSearchResultQuery = ReturnType<typeof useStaffSearch>;
