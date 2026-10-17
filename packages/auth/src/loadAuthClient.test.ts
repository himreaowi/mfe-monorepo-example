import { loadAuthClient } from './loadAuthClient';

describe('loadAuthClient', () => {
  const env = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = env;
    jest.restoreAllMocks();
  });

  it('no auth section → null (disabled)', async () => {
    expect(await loadAuthClient(undefined)).toBeNull();
  });

  it('BFF URLs → bff client', async () => {
    const client = await loadAuthClient({
      sessionUrl: '/s',
      loginUrl: '/l',
      logoutUrl: '/o',
    });
    expect(client?.kind).toBe('bff');
  });

  it('incomplete BFF config → null with an error', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(await loadAuthClient({ sessionUrl: '/s' })).toBeNull();
    expect(error).toHaveBeenCalledWith(
      expect.stringMatching(/needs sessionUrl/),
    );
  });

  it('mock outside production → mock client', async () => {
    jest.spyOn(console, 'info').mockImplementation(() => {});
    const client = await loadAuthClient({ mock: true });
    expect(client?.kind).toBe('mock');
  });

  it('mock in production → null (fail closed)', async () => {
    process.env.NODE_ENV = 'production';
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(await loadAuthClient({ mock: true })).toBeNull();
    expect(error).toHaveBeenCalledWith(
      expect.stringMatching(/production builds ignore/),
    );
  });
});
