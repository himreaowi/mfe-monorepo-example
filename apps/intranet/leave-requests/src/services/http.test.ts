import { apiRoutes } from '@/core/constants/apiRoutes';
import { apiBaseUrl, createApiClient } from './http';

describe('createApiClient', () => {
  it('resolves apiRoutes against settings.apiBaseUrl', () => {
    const http = createApiClient({ apiBaseUrl: 'https://api.example.com/api' });
    expect(http.url(apiRoutes.leave.requests())).toBe(
      'https://api.example.com/api/leave/requests',
    );
    expect(apiBaseUrl(undefined)).toBe('');
  });
});
