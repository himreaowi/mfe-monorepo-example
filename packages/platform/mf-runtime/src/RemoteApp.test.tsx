import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import {
  loadRemote,
  registerRemotes,
} from '@module-federation/enhanced/runtime';
import type { HostProps } from './hostProps';
import { MfeManifestProvider } from './ManifestContext';
import { RemoteApp } from './RemoteApp';
import type { MfeManifest } from './manifest/manifest';

jest.mock('@module-federation/enhanced/runtime', () => ({
  registerRemotes: jest.fn(),
  registerPlugins: jest.fn(),
  loadRemote: jest.fn(),
}));

const loadRemoteMock = loadRemote as jest.Mock;

const manifest: MfeManifest = {
  remotes: {
    staff: {
      entry: 'http://localhost:3101/mf-manifest.json',
      props: { title: 'Staff' },
    },
  },
  settings: { apiBaseUrl: 'https://api.test' },
};

function Probe(props: HostProps) {
  return <pre data-testid="host-props">{JSON.stringify(props)}</pre>;
}

function renderShell(ui: React.ReactNode, path = '/apps/staff/route-1') {
  return render(
    <MfeManifestProvider manifest={manifest}>
      <MemoryRouter initialEntries={[path]}>
        <p>shell header</p>
        <Routes>
          <Route path="apps/staff/*" element={ui} />
        </Routes>
      </MemoryRouter>
    </MfeManifestProvider>,
  );
}

describe('RemoteApp', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    loadRemoteMock.mockReset();
    (registerRemotes as jest.Mock).mockReset();
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => consoleError.mockRestore());

  it('loads <name>/<module> and passes host props (basePath from the splat route)', async () => {
    loadRemoteMock.mockResolvedValue({ default: Probe });
    renderShell(<RemoteApp name="staff" props={{ user: { id: 'u1' } }} />);
    expect(screen.getByTestId('remote-loading')).toBeInTheDocument();
    const props = JSON.parse(
      (await screen.findByTestId('host-props')).textContent!,
    );
    expect(loadRemoteMock).toHaveBeenCalledWith('staff/App');
    expect(props).toEqual({
      settings: { apiBaseUrl: 'https://api.test' },
      title: 'Staff',
      user: { id: 'u1' },
      embedded: true,
      basePath: '/apps/staff',
    });
  });

  it('basePath is a router path: a shell base path (router basename) is not part of it', async () => {
    loadRemoteMock.mockResolvedValue({ default: Probe });
    render(
      <MfeManifestProvider manifest={manifest}>
        <MemoryRouter
          basename="/citizen"
          initialEntries={['/citizen/apps/staff/route-1']}
        >
          <Routes>
            <Route path="apps/staff/*" element={<RemoteApp name="staff" />} />
          </Routes>
        </MemoryRouter>
      </MfeManifestProvider>,
    );
    const props = JSON.parse(
      (await screen.findByTestId('host-props')).textContent!,
    );
    expect(props.basePath).toBe('/apps/staff');
  });

  it('shows RemoteFallback when the remote cannot be loaded, without breaking the shell', async () => {
    loadRemoteMock.mockRejectedValue(
      new Error(
        '[ Federation Runtime ]: Failed to get manifest.\nlong details',
      ),
    );
    const onError = jest.fn();
    renderShell(<RemoteApp name="staff" retries={0} onError={onError} />);
    const fallback = await screen.findByTestId('remote-fallback');
    expect(fallback).toHaveTextContent('Remote unavailable');
    expect(fallback).toHaveTextContent(
      'staff: [ Federation Runtime ]: Failed to get manifest.',
    );
    expect(fallback).not.toHaveTextContent('long details');
    expect(screen.getByText('shell header')).toBeInTheDocument();
    expect(onError).toHaveBeenCalledWith(expect.any(Error), {
      name: 'staff',
      module: './App',
    });
  });

  it('shows RemoteFallback when a CSS file of the remote fails to load', async () => {
    // the remote's chunk loader rejects like this when a <link rel="stylesheet"> errors
    const cssError = Object.assign(
      new Error(
        'Loading CSS chunk 362 failed.\\n(https://staff.example/__federation_expose_App.0a1b2c3d.css)',
      ),
      { code: 'CSS_CHUNK_LOAD_FAILED' },
    );
    loadRemoteMock.mockRejectedValue(cssError);
    renderShell(<RemoteApp name="staff" retries={0} />);
    const fallback = await screen.findByTestId('remote-fallback');
    expect(fallback).toHaveTextContent('staff: Loading CSS chunk 362 failed.');
    expect(fallback).not.toHaveTextContent('.css');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
  });

  it('retries automatically before giving up', async () => {
    loadRemoteMock
      .mockRejectedValueOnce(new Error('blip'))
      .mockResolvedValueOnce({ default: Probe });
    renderShell(<RemoteApp name="staff" retries={1} />);
    expect(await screen.findByTestId('host-props')).toBeInTheDocument();
    expect(loadRemoteMock).toHaveBeenCalledTimes(2);
    // the failed remote is re-registered before the second attempt
    expect(registerRemotes).toHaveBeenCalledWith(
      [{ name: 'staff', entry: 'http://localhost:3101/mf-manifest.json' }],
      { force: true },
    );
  });

  it('"Try again" reloads the remote after a failure', async () => {
    const user = userEvent.setup();
    loadRemoteMock.mockRejectedValueOnce(new Error('down'));
    renderShell(<RemoteApp name="staff" retries={0} />);
    await screen.findByTestId('remote-fallback');
    loadRemoteMock.mockResolvedValueOnce({ default: Probe });
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('host-props')).toBeInTheDocument();
    expect(screen.queryByTestId('remote-fallback')).not.toBeInTheDocument();
  });

  it('catches render errors thrown by the remote', async () => {
    function Broken(): never {
      throw new Error('remote render crash');
    }
    loadRemoteMock.mockResolvedValue({ default: Broken });
    renderShell(<RemoteApp name="staff" retries={0} />);
    expect(await screen.findByTestId('remote-fallback')).toHaveTextContent(
      'staff: remote render crash',
    );
  });

  it('rejects modules without a default export component', async () => {
    loadRemoteMock.mockResolvedValue({ somethingElse: 1 });
    renderShell(<RemoteApp name="staff" module="./Widget" retries={0} />);
    expect(await screen.findByTestId('remote-fallback')).toHaveTextContent(
      'Remote module "staff/Widget" has no default export component.',
    );
  });

  it('shows a fallback for remotes missing from the manifest, without loading anything', () => {
    renderShell(<RemoteApp name="unknown_remote" />);
    expect(screen.getByTestId('remote-fallback')).toHaveTextContent(
      'Remote "unknown_remote" is not configured in mfe-manifest.json.',
    );
    expect(loadRemoteMock).not.toHaveBeenCalled();
  });

  it('works outside a router with an explicit basePath', async () => {
    loadRemoteMock.mockResolvedValue({ default: Probe });
    render(<RemoteApp name="any" basePath="widgets/" />);
    const props = JSON.parse(
      (await screen.findByTestId('host-props')).textContent!,
    );
    expect(props).toMatchObject({
      embedded: true,
      basePath: '/widgets',
      settings: {},
    });
  });
});
