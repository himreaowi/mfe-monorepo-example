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
    registerPwa();
    // jsdom documents are already "complete" in tests
    expect(register).toHaveBeenCalledWith('/service-worker.js', undefined);
  });

  it('reports registration failures to onError instead of throwing', async () => {
    const error = new Error('404');
    register.mockRejectedValue(error);
    const onError = jest.fn();
    registerPwa({ swUrl: '/sw.js', scope: '/', onError });
    await Promise.resolve();
    await Promise.resolve();
    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
    expect(onError).toHaveBeenCalledWith(error);
  });

  it('does nothing without service worker support', () => {
    // @ts-expect-error simulate unsupported browser
    delete navigator.serviceWorker;
    expect(() => registerPwa()).not.toThrow();
  });
});
