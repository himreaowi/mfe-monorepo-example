import { useCallback } from 'react';
import { requireApiClient, useApi } from '@org/use-api';
import { useApiClient } from '@org/mf-runtime/remote';
import { getCategories, getService, listServices } from '../api/catalogueApi';
import type { CatalogueQuery } from '../types/service';

export function useServices({ q, category }: CatalogueQuery) {
  const http = useApiClient();
  const load = useCallback(
    async (signal: AbortSignal) =>
      listServices(requireApiClient(http), { q, category }, signal),
    [http, q, category],
  );
  return useApi(load);
}

export function useCategories() {
  const http = useApiClient();
  const load = useCallback(
    async (signal: AbortSignal) =>
      getCategories(requireApiClient(http), signal),
    [http],
  );
  return useApi(load);
}

export function useService(slug: string) {
  const http = useApiClient();
  const load = useCallback(
    async (signal: AbortSignal) =>
      getService(requireApiClient(http), slug, signal),
    [http, slug],
  );
  return useApi(load);
}
