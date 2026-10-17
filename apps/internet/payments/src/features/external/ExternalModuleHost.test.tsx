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
            basePath: '/payments',
            user: { id: 'u1', name: 'Ada', email: 'dropped@example.com' },
            vendor,
          }}
        >
          <Routes>
            <Route path="payments/*" element={<ExternalModuleHost />} />
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
    renderAt('/payments/receipt/7', vendor);
    expect(screen.getByTestId('external-module-stub')).toHaveTextContent(
      'receipt/7',
    );
    expect(lastProps).toMatchObject({
      name: 'internet_payments',
      config: vendor,
      basePath: '/payments',
      path: 'receipt/7',
      theme: 'light',
      user: { id: 'u1', name: 'Ada' },
    });
    expect(lastProps?.user).not.toHaveProperty('email');
  });

  it('routes vendor navigation through the router and lists vendor events', () => {
    renderAt('/payments', vendor);
    act(() => lastProps?.onNavigate?.('receipt/9'));
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/payments/receipt/9',
    );
    act(() => lastProps?.onNavigate?.('/elsewhere'));
    expect(screen.getByTestId('location')).toHaveTextContent('/elsewhere');
    renderAt('/payments', vendor);
    act(() => {
      lastProps?.onEvent?.('payment:completed', { reference: 'R1' });
      lastProps?.onError?.({
        code: 'x',
        message: 'boom',
        source: 'module',
        fatal: false,
      });
    });
    expect(screen.getAllByTestId('vendor-events').at(-1)).toHaveTextContent(
      'payment:completed {"reference":"R1"}',
    );
    expect(screen.getAllByTestId('vendor-events').at(-1)).toHaveTextContent(
      'module/x: boom',
    );
  });

  it('falls back to the dev mock vendor when the manifest has no vendor config', () => {
    renderAt('/payments');
    expect(lastProps?.config).toMatchObject({
      url: 'http://localhost:3999/mount.js',
    });
  });
});
