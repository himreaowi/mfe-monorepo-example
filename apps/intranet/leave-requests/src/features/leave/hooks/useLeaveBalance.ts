import { useCallback } from 'react';
import { requireApiClient, useApi } from '@org/use-api';
import { useApiClient } from '@org/mf-runtime/remote';
import { getLeaveBalance } from '../api';

export function useLeaveBalance() {
  const http = useApiClient();
  const load = useCallback(
    async (signal: AbortSignal) =>
      getLeaveBalance(requireApiClient(http), signal),
    [http],
  );
  return useApi(load);
}
