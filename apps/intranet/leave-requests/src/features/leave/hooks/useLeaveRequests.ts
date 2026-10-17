import { useCallback } from 'react';
import { useApi } from '@org/use-api';
import { useApiClient } from '@/services/http';
import { getLeaveRequests } from '../api';

export function useLeaveRequests() {
  const http = useApiClient();
  const load = useCallback(
    (signal: AbortSignal) => getLeaveRequests(http, signal),
    [http],
  );
  return useApi(load);
}
