import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  loadRemote,
  registerRemotes,
} from '@module-federation/enhanced/runtime';
import type { MountProps, MountedModule } from './contract';
import { ExternalModule, type ExternalModuleLoader } from './ExternalModule';

jest.mock('@module-federation/enhanced/runtime', () => ({
  registerRemotes: jest.fn(),
  registerPlugins: jest.fn(),
  loadRemote: jest.fn(),
}));

const config = { url: 'https://vendor.example/mount.js', format: 'esm' };

/** A fake vendor module that renders into the element and records the lifecycle. */
function fakeVendor(options: { withUpdate?: boolean; version?: string } = {}) {
  const calls: string[] = [];
  let current: MountProps | null = null;
  const mount = jest.fn((el: HTMLElement, props: MountProps): MountedModule => {
    current = props;
    calls.push(`mount:${props.path}:${props.theme}`);
    const p = document.createElement('p');
    p.dataset.testid = 'vendor';
    p.textContent = `vendor ${props.theme} ${props.user?.name ?? 'anon'}`;
    el.appendChild(p);
    const handle: MountedModule = {
      unmount: () => {
        calls.push('unmount');
        p.remove();
      },
    };
    if (options.withUpdate !== false) {
      handle.update = (next) => {
        current = next;
        calls.push(`update:${next.path}:${next.theme}`);
        p.textContent = `vendor ${next.theme} ${next.user?.name ?? 'anon'}`;
      };
    }
    return handle;
  });
  const load: ExternalModuleLoader = jest.fn(async () => ({
    contractVersion: options.version ?? '1.0.0',
    mount,
  }));
  return { load, mount, calls, props: () => current! };
}

describe('<ExternalModule>', () => {
  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it('mounts with props, updates on change, unmounts on leave', async () => {
    const vendor = fakeVendor();
    const { rerender, unmount } = render(
      <ExternalModule
        name="payments"
        config={{ ...config, config: { merchant: 'm-1' } }}
        basePath="/payments"
        user={{ id: 'u1', name: 'Ada' }}
        load={vendor.load}
      />,
    );
    expect(screen.getByTestId('external-module-loading')).toBeInTheDocument();
    expect(await screen.findByTestId('vendor')).toHaveTextContent(
      'vendor light Ada',
    );
    const first = vendor.props();
    expect(first).toMatchObject({
      contractVersion: '1.0.0',
      basePath: '/payments',
      path: '',
      user: { id: 'u1', name: 'Ada' },
      config: { merchant: 'm-1' },
    });
    expect(Object.isFrozen(first.config)).toBe(true);

    // same values, new objects → no update
    rerender(
      <ExternalModule
        name="payments"
        config={{ ...config, config: { merchant: 'm-1' } }}
        basePath="/payments"
        user={{ id: 'u1', name: 'Ada' }}
        load={vendor.load}
      />,
    );
    rerender(
      <ExternalModule
        name="payments"
        config={{ ...config, config: { merchant: 'm-1' } }}
        basePath="/payments"
        path="/receipts/7"
        theme="dark"
        user={{ id: 'u1', name: 'Ada' }}
        load={vendor.load}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('vendor')).toHaveTextContent('vendor dark'),
    );
    expect(vendor.calls).toEqual(['mount::light', 'update:receipts/7:dark']);
    expect(vendor.load).toHaveBeenCalledTimes(1);
    unmount();
    expect(vendor.calls).toEqual([
      'mount::light',
      'update:receipts/7:dark',
      'unmount',
    ]);
  });

  it('passes callbacks through to the latest host handlers', async () => {
    const vendor = fakeVendor();
    const onNavigate = jest.fn();
    const onEvent = jest.fn();
    const onError = jest.fn();
    render(
      <ExternalModule
        name="payments"
        config={config}
        load={vendor.load}
        onNavigate={onNavigate}
        onEvent={onEvent}
        onError={onError}
      />,
    );
    await screen.findByTestId('vendor');
    act(() => {
      vendor.props().onNavigate('details', { replace: true });
      vendor.props().onEvent('payment:completed', { ref: 'R1' });
      vendor.props().onError({ code: 'slow-api', message: 'retrying' });
    });
    expect(onNavigate).toHaveBeenCalledWith('details', { replace: true });
    expect(onEvent).toHaveBeenCalledWith('payment:completed', { ref: 'R1' });
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'slow-api',
        fatal: false,
        source: 'module',
      }),
    );
    // non-fatal: still mounted
    expect(screen.getByTestId('vendor')).toBeInTheDocument();
  });

  it('a fatal module error unmounts it and shows the fallback; retry remounts', async () => {
    const vendor = fakeVendor();
    render(
      <ExternalModule name="payments" config={config} load={vendor.load} />,
    );
    await screen.findByTestId('vendor');
    act(() =>
      vendor
        .props()
        .onError({ code: 'crashed', message: 'Vendor crashed', fatal: true }),
    );
    expect(await screen.findByTestId('remote-fallback')).toHaveTextContent(
      'payments: Vendor crashed',
    );
    expect(vendor.calls.at(-1)).toBe('unmount');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('vendor')).toBeInTheDocument();
    expect(vendor.load).toHaveBeenLastCalledWith(
      expect.objectContaining({ url: config.url }),
      { attempt: 1 },
    );
  });

  it('load failure → fallback with the reason, reported to onError', async () => {
    const onError = jest.fn();
    const load: ExternalModuleLoader = () =>
      Promise.reject(new Error('Failed to fetch dynamically imported module'));
    render(
      <ExternalModule
        name="payments"
        config={config}
        load={load}
        onError={onError}
      />,
    );
    expect(await screen.findByTestId('remote-fallback')).toHaveTextContent(
      'Failed to fetch dynamically imported module',
    );
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'host', fatal: true }),
    );
  });

  it('incompatible contract major → fallback', async () => {
    const { toExternalModule } = jest.requireActual('./load');
    const load: ExternalModuleLoader = async () =>
      toExternalModule({ contractVersion: '2.0.0', mount: jest.fn() }, 'm');
    render(<ExternalModule name="payments" config={config} load={load} />);
    expect(await screen.findByTestId('remote-fallback')).toHaveTextContent(
      /mount contract 2\.0\.0/,
    );
  });

  it('mount() that throws or returns no unmount → fallback', async () => {
    const throwing: ExternalModuleLoader = async () => ({
      contractVersion: '1.0.0',
      mount: () => {
        throw new Error('render exploded');
      },
    });
    const { unmount } = render(
      <ExternalModule name="a" config={config} load={throwing} />,
    );
    expect(await screen.findByTestId('remote-fallback')).toHaveTextContent(
      'render exploded',
    );
    unmount();
    const bad: ExternalModuleLoader = async () => ({
      contractVersion: '1.0.0',
      mount: () => ({}) as MountedModule,
    });
    render(<ExternalModule name="b" config={config} load={bad} />);
    expect(await screen.findByTestId('remote-fallback')).toHaveTextContent(
      /must return \{ unmount\(\)/,
    );
  });

  it('times out a module that never loads', async () => {
    const load: ExternalModuleLoader = () => new Promise(() => {});
    render(
      <ExternalModule
        name="slow"
        config={{ ...config, timeoutMs: 1000 }}
        load={load}
      />,
    );
    expect(
      await screen.findByTestId('remote-fallback', {}, { timeout: 4000 }),
    ).toHaveTextContent('Loading slow timed out after 1000 ms');
  });

  it('invalid config → fallback without loading', async () => {
    const vendor = fakeVendor();
    const onError = jest.fn();
    render(
      <ExternalModule
        name="payments"
        config={{ url: 'nope', format: 'esm' }}
        load={vendor.load}
        onError={onError}
      />,
    );
    expect(screen.getByTestId('remote-fallback')).toHaveTextContent(
      'invalid external module config',
    );
    expect(vendor.load).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'invalid-config' }),
    );
  });

  it('a module without update() is remounted on prop changes', async () => {
    const vendor = fakeVendor({ withUpdate: false });
    const { rerender } = render(
      <ExternalModule name="p" config={config} load={vendor.load} />,
    );
    await screen.findByTestId('vendor');
    rerender(
      <ExternalModule
        name="p"
        config={config}
        theme="dark"
        load={vendor.load}
      />,
    );
    await waitFor(() =>
      expect(vendor.calls).toEqual(['mount::light', 'unmount', 'mount::dark']),
    );
    expect(screen.getAllByTestId('vendor')).toHaveLength(1);
  });

  it('unmounting while loading unmounts the module once it arrives', async () => {
    const vendor = fakeVendor();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const load: ExternalModuleLoader = async (c, o) => {
      await gate;
      return vendor.load(c, o);
    };
    const { unmount } = render(
      <ExternalModule name="p" config={config} load={load} />,
    );
    unmount();
    release();
    await new Promise((r) => setTimeout(r, 20));
    expect(vendor.mount).not.toHaveBeenCalled();
  });

  it('format mf goes through the Module Federation runtime', async () => {
    const vendor = fakeVendor();
    (loadRemote as jest.Mock).mockResolvedValue({
      contractVersion: '1.0.0',
      mount: vendor.mount,
    });
    render(
      <ExternalModule
        name="mf"
        config={{
          url: 'https://vendor.example/mf-manifest.json',
          format: 'mf',
          remoteName: 'acme_pay',
        }}
      />,
    );
    expect(await screen.findByTestId('vendor')).toBeInTheDocument();
    expect(registerRemotes).toHaveBeenCalledWith(
      [{ name: 'acme_pay', entry: 'https://vendor.example/mf-manifest.json' }],
      { force: true },
    );
    expect(loadRemote).toHaveBeenCalledWith('acme_pay/mount');
  });
});
