import { useCallback } from 'react';
import { useApi } from '@org/use-api';
import { useApiClient } from '@/services/http';
import { getAnnouncement, listAnnouncements } from '../api';

export function useAnnouncements() {
  const http = useApiClient();
  const load = useCallback(
    (signal: AbortSignal) => listAnnouncements(http, signal),
    [http],
  );
  return useApi(load);
}

export function useAnnouncement(id: string) {
  const http = useApiClient();
  const load = useCallback(
    (signal: AbortSignal) => getAnnouncement(http, id, signal),
    [http, id],
  );
  return useApi(load);
}
