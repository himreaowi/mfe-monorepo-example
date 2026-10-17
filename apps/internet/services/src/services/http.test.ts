import { apiRoutes } from '@/core/constants/apiRoutes';
import { apiBaseUrl, createApiClient } from './http';

describe('createApiClient', () => {
  it('resolves apiRoutes against settings.apiBaseUrl', () => {
    const http = createApiClient({ apiBaseUrl: 'https://api.example.com/api' });
    expect(
      http.url(apiRoutes.services.list({ q: '', category: 'Health' })),
    ).toBe('https://api.example.com/api/services?category=Health');
    expect(http.url(apiRoutes.services.bySlug('a b'))).toBe(
      'https://api.example.com/api/services/a%20b',
    );
    expect(apiBaseUrl(undefined)).toBe('');
  });
});
