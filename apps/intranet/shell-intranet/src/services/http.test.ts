import { createApiClient } from './http';

describe('createApiClient', () => {
  it('resolves paths against settings.apiBaseUrl', () => {
    expect(createApiClient({ apiBaseUrl: '/api' }).url('/items')).toBe(
      '/api/items',
    );
  });
});
