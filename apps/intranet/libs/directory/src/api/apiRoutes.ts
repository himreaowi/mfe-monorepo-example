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

/** Staff API paths, joined with settings.apiBaseUrl by the http client. */
export const apiRoutes = defineApiRoutes({
  staff: {
    search: (params: { q?: string; department?: string }) =>
      `/staff${queryString(params)}`,
    byId: (id: string) => `/staff/${encodeURIComponent(id)}`,
  },
});
