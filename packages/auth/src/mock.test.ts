import { createMockAuthClient, MOCK_USER } from './mock';

describe('createMockAuthClient', () => {
  beforeEach(() => {
    jest.spyOn(console, 'info').mockImplementation(() => {});
    window.sessionStorage.clear();
  });

  it('signs in and out as the fake user, persisted in sessionStorage', async () => {
    const client = createMockAuthClient();
    expect(client.kind).toBe('mock');
    expect(await client.getSession()).toEqual({ status: 'signedOut' });
    expect(await client.signIn()).toMatchObject({
      status: 'signedIn',
      user: MOCK_USER,
    });
    // a new client (page reload) still sees the sign-in
    expect(await createMockAuthClient().getSession()).toMatchObject({
      status: 'signedIn',
    });
    expect(await client.signOut()).toEqual({ status: 'signedOut' });
    expect(await createMockAuthClient().getSession()).toEqual({
      status: 'signedOut',
    });
  });

  it('a custom user (mockUser) signs in as that user, with its own session', async () => {
    const business = {
      id: 'mock-corppass-1',
      name: 'Tan Mei Ling (Acme Trading Pte Ltd)',
      roles: ['business-admin'],
    };
    const client = createMockAuthClient({ user: business });
    expect(await client.signIn()).toMatchObject({ user: business });
    // the default mock user (another shell on the same origin) is still signed out
    expect(await createMockAuthClient().getSession()).toEqual({
      status: 'signedOut',
    });
    expect(
      await createMockAuthClient({ user: business }).getSession(),
    ).toMatchObject({ status: 'signedIn', user: business });
  });

  it('works without storage', async () => {
    const client = createMockAuthClient({ storage: null, signedIn: true });
    expect((await client.getSession()).status).toBe('signedIn');
  });
});
