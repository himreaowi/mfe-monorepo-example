import { useCallback } from 'react';
import { useApi } from '@org/use-api';
import { useApiClient } from '@/services/http';
import { getLeaveBalance } from '../api';

export function useLeaveBalance() {
  const http = useApiClient();
  const load = useCallback(
    (signal: AbortSignal) => getLeaveBalance(http, signal),
    [http],
  );
  return useApi(load);
}
