import { useCallback } from 'react';
import { requireApiClient, useApi } from '@org/use-api';
import { useApiClient } from '@org/mf-runtime/remote';
import { getLeaveRequests } from '../api';

export function useLeaveRequests() {
  const http = useApiClient();
  const load = useCallback(
    async (signal: AbortSignal) =>
      getLeaveRequests(requireApiClient(http), signal),
    [http],
  );
  return useApi(load);
}
