import { useQuery } from '@tanstack/react-query';
import { getStaffMember, staffKeys } from '@org/intranet-directory';
import { requireApiClient } from '@org/http-client';
import { useApiClient } from '@org/mf-runtime/remote';

/** One staff member (`null`: unknown id) as a query result; another id loads its own entry. */
export function useStaffMember(id: string) {
  const http = useApiClient();
  return useQuery({
    queryKey: staffKeys.detail(id),
    queryFn: ({ signal }) => getStaffMember(requireApiClient(http), id, signal),
  });
}

export type StaffMemberQuery = ReturnType<typeof useStaffMember>;
