import { apiRoutes } from '@/core/constants/apiRoutes';
import { apiBaseUrl, createApiClient } from './http';

describe('createApiClient', () => {
  it('resolves apiRoutes against settings.apiBaseUrl', () => {
    const http = createApiClient({ apiBaseUrl: 'https://api.example.com/api' });
    expect(http.url(apiRoutes.profile.preferences())).toBe(
      'https://api.example.com/api/profile/me/preferences',
    );
    expect(apiBaseUrl(undefined)).toBe('');
  });
});
