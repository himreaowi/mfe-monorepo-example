import { defineApiRoutes } from '@org/http-client';

/** `?a=1&b=2` without empty values ('' when nothing is left). */
function queryString(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

/** API paths, joined with settings.apiBaseUrl by the http client. */
export const apiRoutes = defineApiRoutes({
  services: {
    list: (params: { q?: string; category?: string }) =>
      `/services${queryString(params)}`,
    bySlug: (slug: string) => `/services/${encodeURIComponent(slug)}`,
  },
});
