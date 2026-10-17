import { apiRoutes } from '@/core/constants/apiRoutes';
import { apiBaseUrl, createApiClient } from './http';

describe('createApiClient', () => {
  it('resolves apiRoutes against settings.apiBaseUrl', () => {
    const http = createApiClient({ apiBaseUrl: 'https://api.example.com/api' });
    expect(http.url(apiRoutes.announcements.byId('a-1'))).toBe(
      'https://api.example.com/api/announcements/a-1',
    );
    expect(apiBaseUrl({})).toBe('');
  });
});
