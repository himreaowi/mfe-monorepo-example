/** @jest-environment @org/jest-config/jsdom-environment */
import { createHttpClient } from './index';

// In a browser environment axios would copy the XSRF-TOKEN cookie into a header.
describe('createHttpClient in a browser', () => {
  afterEach(() => {
    document.cookie = 'XSRF-TOKEN=; max-age=0';
  });

  it('adds no XSRF header from a cookie: the CSRF token comes from the session', async () => {
    document.cookie = 'XSRF-TOKEN=from-cookie';
    const fetchMock = jest
      .fn()
      .mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    const http = createHttpClient({ baseUrl: '/api', fetch: fetchMock });
    await expect(
      http.postJson('/x', {}, { headers: { 'X-CSRF-Token': 'from-session' } }),
    ).resolves.toEqual({ ok: true });
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.has('x-xsrf-token')).toBe(false);
    expect(headers.get('x-csrf-token')).toBe('from-session');
  });
});
