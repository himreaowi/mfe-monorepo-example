import { useQuery } from '@tanstack/react-query';
import { requireApiClient } from '@org/http-client';
import { useApiClient } from '@org/mf-runtime/remote';
import { getLeaveBalance } from '../api/leaveApi';
import { leaveKeys } from '../queryKeys';

/** The balance per leave type as a query result; the page passes it down. */
export function useLeaveBalance() {
  const http = useApiClient();
  return useQuery({
    queryKey: leaveKeys.balance(),
    queryFn: ({ signal }) => getLeaveBalance(requireApiClient(http), signal),
  });
}

export type LeaveBalanceQuery = ReturnType<typeof useLeaveBalance>;
