import { apiRoutes } from '@/core/constants/apiRoutes';
import { createApiClient } from './http';

describe('createApiClient', () => {
  it('resolves apiRoutes against settings.apiBaseUrl', () => {
    const http = createApiClient({ apiBaseUrl: 'https://api.example.com' });
    expect(http.url(apiRoutes.items.byId(7))).toBe(
      'https://api.example.com/items/7',
    );
  });
});
