import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import type { ExternalModuleProps } from '@org/mf-runtime/external';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import { ThemeProvider } from '@org/ui';
import { ExternalModuleHost } from './ExternalModuleHost';

let lastProps: ExternalModuleProps | undefined;
jest.mock('@org/mf-runtime/external', () => ({
  ExternalModule: (props: ExternalModuleProps) => {
    lastProps = props;
    return <div data-testid="external-module-stub">{props.path}</div>;
  },
}));

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

function renderAt(url: string, vendor?: unknown) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[url]}>
        <HostPropsProvider
          value={{
            embedded: true,
            basePath: '/it-helpdesk',
            user: { id: 'u1', name: 'Ada', email: 'dropped@example.com' },
            vendor,
          }}
        >
          <Routes>
            <Route path="it-helpdesk/*" element={<ExternalModuleHost />} />
          </Routes>
          <Location />
        </HostPropsProvider>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('ExternalModuleHost', () => {
  const vendor = { url: 'https://vendor.example/mount.js', format: 'esm' };

  it('passes the manifest config, sub-path, theme and a minimal user to <ExternalModule>', () => {
    renderAt('/it-helpdesk/tickets/HD-7', vendor);
    expect(screen.getByTestId('external-module-stub')).toHaveTextContent(
      'tickets/HD-7',
    );
    expect(lastProps).toMatchObject({
      name: 'intranet_it_helpdesk',
      config: vendor,
      basePath: '/it-helpdesk',
      path: 'tickets/HD-7',
      theme: 'light',
      user: { id: 'u1', name: 'Ada' },
    });
    expect(lastProps?.user).not.toHaveProperty('email');
  });

  it('routes vendor navigation through the router and lists vendor activity', () => {
    renderAt('/it-helpdesk', vendor);
    act(() => lastProps?.onNavigate?.('tickets/HD-1043'));
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/it-helpdesk/tickets/HD-1043',
    );
    act(() => lastProps?.onNavigate?.('/elsewhere'));
    expect(screen.getByTestId('location')).toHaveTextContent('/elsewhere');
    renderAt('/it-helpdesk', vendor);
    act(() => {
      lastProps?.onEvent?.('ticket:created', {
        id: 'HD-1043',
        summary: 'Monitor flickers',
      });
      lastProps?.onError?.({
        code: 'x',
        message: 'boom',
        source: 'module',
        fatal: false,
      });
    });
    expect(screen.getAllByTestId('vendor-events').at(-1)).toHaveTextContent(
      'Ticket HD-1043 created: Monitor flickers',
    );
    expect(screen.getAllByTestId('vendor-events').at(-1)).toHaveTextContent(
      'The ticket desk reported a problem: boom',
    );
  });

  it('falls back to the dev example vendor when the manifest has no vendor config', () => {
    renderAt('/it-helpdesk');
    expect(lastProps?.config).toMatchObject({
      url: 'http://localhost:3990/helpdesk/1.0.0/mount.js',
      config: { apiBaseUrl: 'http://localhost:3910/api' },
    });
  });
});
