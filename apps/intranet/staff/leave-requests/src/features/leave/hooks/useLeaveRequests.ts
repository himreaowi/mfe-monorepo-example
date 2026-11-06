import { useQuery } from '@tanstack/react-query';
import { requireApiClient } from '@org/http-client';
import { useApiClient } from '@org/mf-runtime/remote';
import { getLeaveRequests } from '../api/leaveApi';
import { leaveKeys } from '../queryKeys';

/** The user's leave requests as a query result; the page passes it down. */
export function useLeaveRequests() {
  const http = useApiClient();
  return useQuery({
    queryKey: leaveKeys.requests(),
    queryFn: ({ signal }) => getLeaveRequests(requireApiClient(http), signal),
  });
}

export type LeaveRequestsQuery = ReturnType<typeof useLeaveRequests>;
