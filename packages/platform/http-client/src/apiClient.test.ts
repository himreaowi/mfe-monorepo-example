import { createFakeFetch } from '@org/jest-config/fetch';
import { apiBaseUrlFrom, createApiClient } from './apiClient';

describe('createApiClient', () => {
  it('resolves paths against settings.apiBaseUrl', () => {
    const http = createApiClient({ apiBaseUrl: 'https://api.example.com' });
    expect(http.url('/items/7')).toBe('https://api.example.com/items/7');
  });

  it('reads settings.apiBaseUrl only when it is a string', () => {
    expect(apiBaseUrlFrom({ apiBaseUrl: '/api' })).toBe('/api');
    expect(apiBaseUrlFrom({ apiBaseUrl: 42 })).toBe('');
    expect(apiBaseUrlFrom(undefined)).toBe('');
    expect(apiBaseUrlFrom(null)).toBe('');
  });

  it('sends the session cookie to a cross-origin API (credentials: include)', async () => {
    const fetch = createFakeFetch({ 'GET /api/items': { body: [] } });
    const http = createApiClient(
      { apiBaseUrl: 'https://api.example.com/api' },
      { fetch },
    );
    await http.getJson('/items');
    expect(fetch.calls[0].init.credentials).toBe('include');
  });
});
