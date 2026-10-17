import { apiRoutes } from '@/core/constants/apiRoutes';
import { apiBaseUrl, createApiClient } from './http';

describe('createApiClient', () => {
  it('resolves apiRoutes against settings.apiBaseUrl', () => {
    const http = createApiClient({ apiBaseUrl: 'https://api.example.com/api' });
    expect(http.url(apiRoutes.staff.byId('s 1'))).toBe(
      'https://api.example.com/api/staff/s%201',
    );
    expect(http.url(apiRoutes.staff.search({ q: 'ann', department: '' }))).toBe(
      'https://api.example.com/api/staff?q=ann',
    );
  });

  it('has no base URL without settings', () => {
    expect(apiBaseUrl(undefined)).toBe('');
    expect(apiBaseUrl({ apiBaseUrl: 42 })).toBe('');
  });
});
