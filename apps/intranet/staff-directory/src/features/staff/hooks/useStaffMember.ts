import { useCallback } from 'react';
import { useApi } from '@org/use-api';
import { useApiClient } from '@/services/http';
import { getStaffMember } from '../api';

export function useStaffMember(id: string) {
  const http = useApiClient();
  const load = useCallback(
    (signal: AbortSignal) => getStaffMember(http, id, signal),
    [http, id],
  );
  return useApi(load);
}
