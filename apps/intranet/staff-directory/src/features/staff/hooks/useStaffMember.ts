import { useCallback } from 'react';
import { requireApiClient, useApi } from '@org/use-api';
import { useApiClient } from '@org/mf-runtime/remote';
import { getStaffMember } from '../api';

export function useStaffMember(id: string) {
  const http = useApiClient();
  const load = useCallback(
    async (signal: AbortSignal) =>
      getStaffMember(requireApiClient(http), id, signal),
    [http, id],
  );
  return useApi(load);
}
