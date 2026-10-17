import { createAuthClient, parseSessionBody, toAuthUser } from './client';

type FakeResponse = { status: number; body?: unknown; invalidJson?: boolean };

function fakeFetch(...responses: (FakeResponse | Error)[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = jest.fn(
    async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      const next = responses.shift();
      if (!next) throw new Error('no more responses');
      if (next instanceof Error) throw next;
      return {
        status: next.status,
        ok: next.status >= 200 && next.status < 300,
        json: async () => {
          if (next.invalidJson) throw new SyntaxError('Unexpected token <');
          return next.body;
        },
      } as unknown as Response;
    },
  );
  return { fetch: fn as unknown as typeof fetch, calls };
}

const config = {
  sessionUrl: '/bff/session',
  loginUrl: 'https://bff.example.com/login',
  logoutUrl: '/bff/logout',
};

describe('createAuthClient', () => {
  it('GET session with credentials include → signed in, PDPA-minimal user', async () => {
    const { fetch, calls } = fakeFetch({
      status: 200,
      body: {
        user: {
          id: 'u-1',
          name: 'Tan Ah Kow',
          roles: ['citizen'],
          nric: 'S1234567D',
          email: 'x@example.com',
        },
        csrfToken: 'csrf-1',
        expiresAt: '2030-01-01T00:00:00Z',
      },
    });
    const client = createAuthClient(config, {
      fetch,
      baseUrl: 'https://app.example.com/x',
    });
    const session = await client.getSession();
    expect(session).toEqual({
      status: 'signedIn',
      user: { id: 'u-1', name: 'Tan Ah Kow', roles: ['citizen'] },
      csrfToken: 'csrf-1',
      expiresAt: '2030-01-01T00:00:00Z',
    });
    expect(calls[0].url).toBe('https://app.example.com/bff/session');
    expect(calls[0].init.credentials).toBe('include');
    expect(calls[0].init.cache).toBe('no-store');
    expect(calls[0].init.method).toBe('GET');
  });

  it('401 → signed out without error', async () => {
    const { fetch } = fakeFetch({ status: 401 });
    expect(await createAuthClient(config, { fetch }).getSession()).toEqual({
      status: 'signedOut',
    });
  });

  it('never throws: network error, 5xx, bad JSON, bad body → signed out + error', async () => {
    const { fetch } = fakeFetch(
      new TypeError('Failed to fetch'),
      { status: 503 },
      { status: 200, invalidJson: true },
      { status: 200, body: { user: { name: 'no id' } } },
    );
    const client = createAuthClient(config, { fetch });
    const a = await client.getSession();
    expect(a).toMatchObject({
      status: 'signedOut',
      error: { code: 'network' },
    });
    expect(a.status === 'signedOut' && a.error?.message).toMatch(
      /Failed to fetch/,
    );
    expect(await client.getSession()).toMatchObject({
      status: 'signedOut',
      error: { code: 'http', status: 503 },
    });
    expect(await client.getSession()).toMatchObject({
      status: 'signedOut',
      error: { code: 'invalid-response' },
    });
    expect(await client.getSession()).toMatchObject({
      status: 'signedOut',
      error: { code: 'invalid-response' },
    });
  });

  it('times out → signed out + timeout error', async () => {
    const fetch = jest.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    ) as unknown as typeof globalThis.fetch;
    const client = createAuthClient({ ...config, timeoutMs: 20 }, { fetch });
    expect(await client.getSession()).toMatchObject({
      status: 'signedOut',
      error: { code: 'timeout' },
    });
  });

  it('signIn navigates to loginUrl with an absolute returnTo', async () => {
    const navigate = jest.fn();
    const client = createAuthClient(
      { ...config, returnToParam: 'next' },
      { navigate, fetch: fakeFetch().fetch },
    );
    expect(await client.signIn({ returnTo: '/my-profile?tab=1' })).toBeNull();
    const target = new URL(navigate.mock.calls[0][0]);
    expect(target.origin + target.pathname).toBe(
      'https://bff.example.com/login',
    );
    expect(target.searchParams.get('next')).toBe(
      `${window.location.origin}/my-profile?tab=1`,
    );
  });

  it('signOut POSTs with the CSRF header and follows redirectUrl', async () => {
    const navigate = jest.fn();
    const { fetch, calls } = fakeFetch(
      { status: 200, body: { redirectUrl: 'https://idp.example/logout' } },
      { status: 204 },
    );
    const client = createAuthClient(
      { ...config, csrfHeaderName: 'X-XSRF' },
      { fetch, navigate },
    );
    expect(await client.signOut({ csrfToken: 't' })).toEqual({
      status: 'signedOut',
    });
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.credentials).toBe('include');
    expect((calls[0].init.headers as Record<string, string>)['X-XSRF']).toBe(
      't',
    );
    expect(navigate).toHaveBeenCalledWith('https://idp.example/logout');
    expect(await client.signOut()).toEqual({ status: 'signedOut' });
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('signOut reports an unconfirmed sign-out but still resolves signed out', async () => {
    const { fetch } = fakeFetch(new TypeError('Failed to fetch'), {
      status: 500,
    });
    const client = createAuthClient(config, { fetch });
    expect(await client.signOut()).toMatchObject({
      status: 'signedOut',
      error: { message: expect.stringMatching(/could not be confirmed/) },
    });
    expect(await client.signOut()).toMatchObject({
      status: 'signedOut',
      error: { code: 'http', status: 500 },
    });
  });
});

describe('session body', () => {
  it('drops unknown user fields and non-string roles', () => {
    expect(toAuthUser({ id: 'a', roles: ['x', 1], phone: '9' })).toEqual({
      id: 'a',
    });
    expect(toAuthUser({ id: '' })).toBeNull();
    expect(parseSessionBody({ user: null })).toEqual({ status: 'signedOut' });
    expect(parseSessionBody('nope')).toMatchObject({
      error: { code: 'invalid-response' },
    });
  });
});
