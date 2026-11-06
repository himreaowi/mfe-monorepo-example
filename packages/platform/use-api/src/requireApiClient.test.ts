import { API_NOT_CONFIGURED, requireApiClient } from './requireApiClient';

describe('requireApiClient', () => {
  it('returns the client', () => {
    const client = { url: (p: string) => p };
    expect(requireApiClient(client)).toBe(client);
  });

  it('throws a clear error without one (no settings.apiBaseUrl)', () => {
    expect(() => requireApiClient(undefined)).toThrow(API_NOT_CONFIGURED);
  });

  it('rejects an async loader, so useApi shows its error state', async () => {
    const load = async () => requireApiClient<{ ok: true }>(undefined);
    await expect(load()).rejects.toThrow(API_NOT_CONFIGURED);
  });
});
