import { defineApiRoutes } from '@org/http-client';

/** API paths, joined with settings.apiBaseUrl by the http client. */
export const apiRoutes = defineApiRoutes({
  announcements: {
    list: () => '/announcements',
    byId: (id: string) => `/announcements/${encodeURIComponent(id)}`,
  },
});
