import { useCallback } from 'react';
import { requireApiClient, useApi } from '@org/use-api';
import { useApiClient } from '@org/mf-runtime/remote';
import { getDepartments } from '../api/staffApi';

export function useDepartments() {
  const http = useApiClient();
  const load = useCallback(
    async (signal: AbortSignal) =>
      getDepartments(requireApiClient(http), signal),
    [http],
  );
  return useApi(load);
}
