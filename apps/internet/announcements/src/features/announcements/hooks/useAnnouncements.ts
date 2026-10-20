import { useCallback } from 'react';
import { requireApiClient, useApi } from '@org/use-api';
import { useApiClient } from '@org/mf-runtime/remote';
import { getAnnouncement, listAnnouncements } from '../api';

export function useAnnouncements() {
  const http = useApiClient();
  const load = useCallback(
    async (signal: AbortSignal) =>
      listAnnouncements(requireApiClient(http), signal),
    [http],
  );
  return useApi(load);
}

export function useAnnouncement(id: string) {
  const http = useApiClient();
  const load = useCallback(
    async (signal: AbortSignal) =>
      getAnnouncement(requireApiClient(http), id, signal),
    [http, id],
  );
  return useApi(load);
}
