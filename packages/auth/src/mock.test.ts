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

  it('works without storage', async () => {
    const client = createMockAuthClient({ storage: null, signedIn: true });
    expect((await client.getSession()).status).toBe('signedIn');
  });
});
