import { createHttpClient } from '@org/http-client';
import { getProfile, updatePreferences } from './profileApi';

function fakeHttp(status: number, body?: unknown) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchFn = jest.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return {
        ok: status >= 200 && status < 300,
        status,
        statusText: '',
        url: String(input),
        text: async () => (body === undefined ? '' : JSON.stringify(body)),
      } as Response;
    },
  );
  return {
    http: createHttpClient({
      baseUrl: 'https://api.test/api',
      credentials: 'include',
      fetch: fetchFn,
    }),
    calls,
  };
}

describe('profile api', () => {
  it('reads the profile with the session cookie, filling missing preferences', async () => {
    const { http, calls } = fakeHttp(200, { id: 'u1', preferences: {} });
    await expect(getProfile(http)).resolves.toMatchObject({
      id: 'u1',
      preferences: { emailUpdates: false, smsReminders: false },
    });
    expect(calls[0].url).toBe('https://api.test/api/profile/me');
    expect(calls[0].init?.credentials).toBe('include');
  });

  it('PUTs preferences with the CSRF header', async () => {
    const { http, calls } = fakeHttp(200, {
      id: 'u1',
      preferences: { emailUpdates: true, smsReminders: true },
    });
    await updatePreferences(
      http,
      { emailUpdates: true, smsReminders: true },
      { 'X-CSRF-Token': 'csrf-1' },
    );
    expect(calls[0].init?.method).toBe('PUT');
    const headers = new Headers(calls[0].init?.headers);
    expect(headers.get('x-csrf-token')).toBe('csrf-1');
    expect(headers.get('content-type')).toBe('application/json');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      emailUpdates: true,
      smsReminders: true,
    });
  });

  it('throws on 403 (missing CSRF token)', async () => {
    const { http } = fakeHttp(403, {
      message: 'Missing or invalid CSRF token',
    });
    await expect(
      updatePreferences(http, { emailUpdates: false, smsReminders: false }, {}),
    ).rejects.toMatchObject({ status: 403 });
  });
});
