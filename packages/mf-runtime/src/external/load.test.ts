import { EXTERNAL_EVENTS, type MountProps } from './contract';
import {
  ExternalModuleLoadError,
  loadExternalModule,
  toExternalModule,
  webComponentMount,
  withTimeout,
} from './load';

const mount = jest.fn(() => ({ unmount: jest.fn() }));

function props(over: Partial<MountProps> = {}): MountProps {
  return {
    contractVersion: '1.0.0',
    basePath: '/x',
    path: '',
    theme: 'light',
    locale: 'en',
    user: null,
    config: {},
    onNavigate: jest.fn(),
    onEvent: jest.fn(),
    onError: jest.fn(),
    ...over,
  };
}

describe('toExternalModule', () => {
  it('accepts named exports or a default export object', () => {
    expect(
      toExternalModule({ contractVersion: '1.0.0', mount }, 'm')
        .contractVersion,
    ).toBe('1.0.0');
    expect(
      toExternalModule({ default: { contractVersion: '1.2.0', mount } }, 'm')
        .contractVersion,
    ).toBe('1.2.0');
  });

  it('rejects modules without mount or with another major', () => {
    expect(() => toExternalModule({ contractVersion: '1.0.0' }, 'm')).toThrow(
      expect.objectContaining({ code: 'invalid-module' }),
    );
    expect(() =>
      toExternalModule({ contractVersion: '2.0.0', mount }, 'm'),
    ).toThrow(expect.objectContaining({ code: 'incompatible-contract' }));
    expect(() => toExternalModule({ mount }, 'm')).toThrow(/\(none\)/);
  });
});

describe('loadExternalModule', () => {
  it('esm: imports the absolute URL, picks exportName, adds a retry parameter', async () => {
    const importModule = jest.fn(async () => ({
      payments: { contractVersion: '1.0.0', mount },
    }));
    const m = await loadExternalModule(
      { url: '/vendor/mount.js', format: 'esm', exportName: 'payments' },
      { importModule, attempt: 2 },
    );
    expect(importModule).toHaveBeenCalledWith(
      `${window.location.origin}/vendor/mount.js?mfeRetry=2`,
    );
    const el = document.createElement('div');
    m.mount(el, props());
    expect(mount).toHaveBeenCalledWith(
      el,
      expect.objectContaining({ basePath: '/x' }),
    );
  });

  it('esm: import failure → load-failed', async () => {
    await expect(
      loadExternalModule(
        { url: 'https://v.example/m.js', format: 'esm' },
        {
          importModule: () =>
            Promise.reject(
              new TypeError('Failed to fetch dynamically imported module'),
            ),
        },
      ),
    ).rejects.toMatchObject({
      code: 'load-failed',
      message: expect.stringMatching(/Failed to fetch/),
    });
  });

  it('script: uses an existing global, or reports a failed script', async () => {
    (globalThis as Record<string, unknown>).AcmeTest = {
      contractVersion: '1.0.0',
      mount,
    };
    const m = await loadExternalModule({
      url: '/a.js',
      format: 'script',
      global: 'AcmeTest',
    });
    expect(m.contractVersion).toBe('1.0.0');
    delete (globalThis as Record<string, unknown>).AcmeTest;

    const pending = loadExternalModule({
      url: '/missing.js',
      format: 'script',
      global: 'Nope',
      integrity: 'sha384-x',
    });
    const script = document.head.querySelector<HTMLScriptElement>(
      'script[data-external-module$="/missing.js"]',
    );
    expect(script?.integrity).toBe('sha384-x');
    expect(script?.crossOrigin).toBe('anonymous');
    script?.onerror?.(new Event('error'));
    await expect(pending).rejects.toMatchObject({ code: 'load-failed' });
    expect(
      document.head.querySelector(
        'script[data-external-module$="/missing.js"]',
      ),
    ).toBeNull();
  });

  it('web-component: needs a static contractVersion, mounts an element with props', async () => {
    class Good extends HTMLElement {
      static contractVersion = '1.0.0';
    }
    customElements.define('acme-good', Good);
    class Bad extends HTMLElement {}
    customElements.define('acme-bad', Bad);
    await expect(
      loadExternalModule({
        url: '/b.js',
        format: 'web-component',
        tagName: 'acme-bad',
      }),
    ).rejects.toMatchObject({ code: 'incompatible-contract' });
    const m = await loadExternalModule({
      url: '/g.js',
      format: 'web-component',
      tagName: 'acme-good',
    });
    const host = document.createElement('div');
    const p = props();
    const handle = await m.mount(host, p);
    const el = host.querySelector('acme-good') as HTMLElement & {
      props?: MountProps;
    };
    expect(el.props).toBe(p);
    const next = props({ path: 'details' });
    handle.update?.(next);
    expect(el.props).toBe(next);
    el.dispatchEvent(
      new CustomEvent(EXTERNAL_EVENTS.navigate, {
        detail: { to: 'a', replace: true },
      }),
    );
    el.dispatchEvent(
      new CustomEvent(EXTERNAL_EVENTS.event, {
        detail: { name: 'paid', detail: { ref: 1 } },
      }),
    );
    el.dispatchEvent(
      new CustomEvent(EXTERNAL_EVENTS.error, {
        detail: { code: 'x', message: 'boom', fatal: true },
      }),
    );
    expect(next.onNavigate).toHaveBeenCalledWith('a', { replace: true });
    expect(next.onEvent).toHaveBeenCalledWith('paid', { ref: 1 });
    expect(next.onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'x', fatal: true }),
    );
    await handle.unmount();
    expect(host.children).toHaveLength(0);
  });

  it('mf: needs the injected loader', async () => {
    await expect(
      loadExternalModule({ url: '/m.json', format: 'mf', remoteName: 'acme' }),
    ).rejects.toMatchObject({ code: 'invalid-config' });
    const loadMf = jest.fn(async () => ({ contractVersion: '1.0.0', mount }));
    await loadExternalModule(
      { url: '/m.json', format: 'mf', remoteName: 'acme' },
      { loadMf },
    );
    expect(loadMf).toHaveBeenCalledWith(
      expect.objectContaining({ remoteName: 'acme' }),
    );
  });
});

describe('withTimeout', () => {
  it('rejects after the timeout and hands a late value to onLate', async () => {
    jest.useFakeTimers();
    try {
      let resolveLate!: (v: string) => void;
      const late = jest.fn();
      const p = withTimeout(
        new Promise<string>((r) => (resolveLate = r)),
        100,
        'Mounting x',
        late,
      );
      jest.advanceTimersByTime(101);
      await expect(p).rejects.toBeInstanceOf(ExternalModuleLoadError);
      await expect(p).rejects.toMatchObject({ code: 'timeout' });
      resolveLate('handle');
      await Promise.resolve();
      expect(late).toHaveBeenCalledWith('handle');
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('webComponentMount', () => {
  it('creates one element per mount', async () => {
    customElements.define('acme-plain', class extends HTMLElement {});
    const host = document.createElement('div');
    const h1 = await webComponentMount('acme-plain')(host, props());
    const h2 = await webComponentMount('acme-plain')(host, props());
    expect(host.querySelectorAll('acme-plain')).toHaveLength(2);
    await h1.unmount();
    await h2.unmount();
    expect(host.children).toHaveLength(0);
  });
});
