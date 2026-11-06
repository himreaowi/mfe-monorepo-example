import { registerPwa } from './registerPwa';

describe('registerPwa', () => {
  const register = jest.fn();

  beforeEach(() => {
    register.mockReset();
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { register },
    });
  });

  afterEach(() => {
    // @ts-expect-error test cleanup
    delete navigator.serviceWorker;
  });

  it('registers /service-worker.js once the page has loaded', async () => {
    register.mockResolvedValue({});
    registerPwa({ enabled: true });
    // jsdom documents are already "complete" in tests
    expect(register).toHaveBeenCalledWith('/service-worker.js', undefined);
  });

  it('below a base path: <basePath>/service-worker.js, scoped to <basePath>/', async () => {
    register.mockResolvedValue({});
    registerPwa({ enabled: true, basePath: '/citizen' });
    await Promise.resolve();
    expect(register).toHaveBeenCalledWith('/citizen/service-worker.js', {
      scope: '/citizen/',
    });
  });

  it('reports registration failures to onError instead of throwing', async () => {
    const error = new Error('404');
    register.mockRejectedValue(error);
    const onError = jest.fn();
    registerPwa({ enabled: true, swUrl: '/sw.js', scope: '/', onError });
    await Promise.resolve();
    await Promise.resolve();
    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
    expect(onError).toHaveBeenCalledWith(error);
  });

  it('is off outside production builds by default', () => {
    registerPwa();
    expect(register).not.toHaveBeenCalled();
  });

  it('does nothing without service worker support', () => {
    // @ts-expect-error simulate unsupported browser
    delete navigator.serviceWorker;
    expect(() => registerPwa({ enabled: true })).not.toThrow();
  });
});
