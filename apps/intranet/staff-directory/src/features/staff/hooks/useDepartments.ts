import { useCallback } from 'react';
import { useApi } from '@org/use-api';
import { useApiClient } from '@/services/http';
import { getDepartments } from '../api';

export function useDepartments() {
  const http = useApiClient();
  const load = useCallback(
    (signal: AbortSignal) => getDepartments(http, signal),
    [http],
  );
  return useApi(load);
}
