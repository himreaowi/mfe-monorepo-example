import { useCallback } from 'react';
import { useApi } from '@org/use-api';
import { useApiClient } from '@/services/http';
import { getCategories, getService, listServices } from '../api';
import type { CatalogueQuery } from '../types/service';

export function useServices({ q, category }: CatalogueQuery) {
  const http = useApiClient();
  const load = useCallback(
    (signal: AbortSignal) => listServices(http, { q, category }, signal),
    [http, q, category],
  );
  return useApi(load);
}

export function useCategories() {
  const http = useApiClient();
  const load = useCallback(
    (signal: AbortSignal) => getCategories(http, signal),
    [http],
  );
  return useApi(load);
}

export function useService(slug: string) {
  const http = useApiClient();
  const load = useCallback(
    (signal: AbortSignal) => getService(http, slug, signal),
    [http, slug],
  );
  return useApi(load);
}
