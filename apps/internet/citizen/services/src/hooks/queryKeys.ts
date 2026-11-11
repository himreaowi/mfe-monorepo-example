import type { CatalogueQuery } from '@/types/service';

/**
 * The catalogue's query keys, general to specific. The search text and topic are part of the
 * services key, so a new search loads new data and the same search again comes from the cache
 * (docs/coding-conventions.md "Data fetching").
 */
export const catalogueKeys = {
  all: ['catalogue'] as const,
  services: ({ q, category }: CatalogueQuery) =>
    [...catalogueKeys.all, 'services', { q, category }] as const,
  categories: () => [...catalogueKeys.all, 'categories'] as const,
  service: (slug: string) => [...catalogueKeys.all, 'service', slug] as const,
};
