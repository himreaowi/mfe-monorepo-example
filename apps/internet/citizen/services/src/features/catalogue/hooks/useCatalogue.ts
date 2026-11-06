import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { requireApiClient } from '@org/http-client';
import { useApiClient } from '@org/mf-runtime/remote';
import { getCategories, getService, listServices } from '../api/catalogueApi';
import { catalogueKeys } from '../queryKeys';
import type { CatalogueQuery } from '../types/service';

/**
 * The services for a search as a query result. The previous list stays (`placeholderData`)
 * while a new search loads; `isPlaceholderData` says so.
 */
export function useServices({ q, category }: CatalogueQuery) {
  const http = useApiClient();
  return useQuery({
    queryKey: catalogueKeys.services({ q, category }),
    queryFn: ({ signal }) =>
      listServices(requireApiClient(http), { q, category }, signal),
    placeholderData: keepPreviousData,
  });
}

export type ServicesQuery = ReturnType<typeof useServices>;

/** The topics for the filter. */
export function useCategories() {
  const http = useApiClient();
  return useQuery({
    queryKey: catalogueKeys.categories(),
    queryFn: ({ signal }) => getCategories(requireApiClient(http), signal),
  });
}

export type CategoriesQuery = ReturnType<typeof useCategories>;

/** One service by slug (`null`: unknown slug); another slug has its own cache entry. */
export function useService(slug: string) {
  const http = useApiClient();
  return useQuery({
    queryKey: catalogueKeys.service(slug),
    queryFn: ({ signal }) => getService(requireApiClient(http), slug, signal),
  });
}

export type ServiceQuery = ReturnType<typeof useService>;
