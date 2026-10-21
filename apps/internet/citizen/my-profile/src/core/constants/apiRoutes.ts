import { defineApiRoutes } from '@org/http-client';

/** API paths, joined with settings.apiBaseUrl by the http client. */
export const apiRoutes = defineApiRoutes({
  profile: {
    me: () => '/profile/me',
    preferences: () => '/profile/me/preferences',
  },
});
