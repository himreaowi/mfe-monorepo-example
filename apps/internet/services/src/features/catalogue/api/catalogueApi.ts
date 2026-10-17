import { HttpClientError, type HttpClient } from '@org/http-client';
import { apiRoutes } from '@/core/constants/apiRoutes';
import type {
  CatalogueQuery,
  CatalogueResult,
  Service,
} from '../types/service';

export async function listServices(
  http: HttpClient,
  { q, category }: CatalogueQuery,
  signal?: AbortSignal,
): Promise<CatalogueResult> {
  const result = await http.getJson<Partial<CatalogueResult>>(
    apiRoutes.services.list({ q: q.trim(), category }),
    { signal },
  );
  const items = result?.items ?? [];
  return {
    items,
    total: result?.total ?? items.length,
    categories: result?.categories ?? [],
  };
}

/** Every category (for the filter), from the unfiltered list. */
export async function getCategories(
  http: HttpClient,
  signal?: AbortSignal,
): Promise<string[]> {
  return (await listServices(http, { q: '', category: '' }, signal)).categories;
}

/** One service, or `null` when the name is unknown (404). */
export async function getService(
  http: HttpClient,
  slug: string,
  signal?: AbortSignal,
): Promise<Service | null> {
  try {
    const service = await http.getJson<Service>(
      apiRoutes.services.bySlug(slug),
      {
        signal,
      },
    );
    return {
      ...service,
      eligibility: service.eligibility ?? [],
      documents: service.documents ?? [],
      steps: service.steps ?? [],
      fee: service.fee ?? null,
    };
  } catch (error) {
    if (error instanceof HttpClientError && error.status === 404) return null;
    throw error;
  }
}
