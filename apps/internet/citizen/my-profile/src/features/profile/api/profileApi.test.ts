import { createHttpClient } from '@org/http-client';
import { createFakeFetch, type FakeRoute } from '@org/jest-config/fetch';
import { getProfile, updatePreferences } from './profileApi';

function fakeHttp(routes: Record<string, FakeRoute>) {
  const fetch = createFakeFetch(routes);
  return {
    http: createHttpClient({
      baseUrl: 'https://api.test/api',
      credentials: 'include',
      fetch,
    }),
    fetch,
  };
}

describe('profile api', () => {
  it('reads the profile with the session cookie, filling missing preferences', async () => {
    const { http, fetch } = fakeHttp({
      'GET /api/profile/me': { body: { id: 'u1', preferences: {} } },
    });
    await expect(getProfile(http)).resolves.toMatchObject({
      id: 'u1',
      preferences: { emailUpdates: false, smsReminders: false },
    });
    expect(fetch.calls[0].url).toBe('https://api.test/api/profile/me');
    expect(fetch.calls[0].init.credentials).toBe('include');
  });

  it('PUTs preferences with the CSRF header', async () => {
    const { http, fetch } = fakeHttp({
      'PUT /api/profile/me/preferences': ({ body }) => ({
        body: { id: 'u1', preferences: body },
      }),
    });
    await updatePreferences(
      http,
      { emailUpdates: true, smsReminders: true },
      { 'X-CSRF-Token': 'csrf-1' },
    );
    const [call] = fetch.calls;
    expect(call.method).toBe('PUT');
    const headers = new Headers(call.init.headers);
    expect(headers.get('x-csrf-token')).toBe('csrf-1');
    expect(headers.get('content-type')).toBe('application/json');
    expect(call.body).toEqual({ emailUpdates: true, smsReminders: true });
  });

  it('throws on 403 (missing CSRF token) and keeps the 422 body', async () => {
    const { http } = fakeHttp({
      'PUT /api/profile/me/preferences': ({ init }) =>
        new Headers(init.headers).has('x-csrf-token')
          ? { status: 422, body: { errors: { preferences: 'Invalid' } } }
          : { status: 403, body: { message: 'Missing or invalid CSRF token' } },
    });
    const off = { emailUpdates: false, smsReminders: false };
    await expect(updatePreferences(http, off, {})).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      updatePreferences(http, off, { 'X-CSRF-Token': 't' }),
    ).rejects.toMatchObject({
      status: 422,
      body: { errors: { preferences: 'Invalid' } },
    });
  });
});
