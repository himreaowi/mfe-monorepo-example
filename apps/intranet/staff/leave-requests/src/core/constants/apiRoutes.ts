import { defineApiRoutes } from '@org/http-client';

/** API paths, joined with settings.apiBaseUrl by the http client. */
export const apiRoutes = defineApiRoutes({
  leave: {
    balance: () => '/leave/balance',
    requests: () => '/leave/requests',
  },
});
