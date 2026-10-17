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
  return <span data-testid="location">{useLocation().pathname}</span>;
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

const vendor = {
  url: 'https://pay.example/element.js',
  format: 'web-component',
  tagName: 'x-pay',
};

describe('ExternalModuleHost (payments)', () => {
  it('passes the manifest config, sub-path, theme and a minimal user', () => {
    renderAt('/payments/receipt/BP-1', vendor);
    expect(lastProps).toMatchObject({
      name: 'internet_payments',
      config: vendor,
      basePath: '/payments',
      path: 'receipt/BP-1',
      theme: 'light',
      user: { id: 'u1', name: 'Ada' },
    });
    expect(lastProps?.user).not.toHaveProperty('email');
  });

  it('confirms a completed payment from the vendor event and routes vendor navigation', () => {
    renderAt('/payments', vendor);
    act(() => {
      lastProps?.onEvent?.('payment:completed', {
        reference: 'BP-20261018-0001',
        amount: 1500,
        currency: 'SGD',
        description: 'Dog licence renewal 2027',
      });
      lastProps?.onNavigate?.('receipt/BP-20261018-0001');
    });
    expect(screen.getByTestId('payment-confirmation')).toHaveTextContent(
      'Payment received: SGD 15.00 for Dog licence renewal 2027. Reference BP-20261018-0001.',
    );
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/payments/receipt/BP-20261018-0001',
    );
  });

  it('ignores malformed events and shows vendor errors', () => {
    renderAt('/payments', vendor);
    act(() => {
      lastProps?.onEvent?.('payment:completed', { reference: 42 });
      lastProps?.onError?.({
        source: 'module',
        code: 'invalid-config',
        message: 'config.amount must be a positive whole number of cents',
        fatal: true,
      });
    });
    expect(
      screen.queryByTestId('payment-confirmation'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The payment service reported a problem: config.amount must be',
    );
  });

  it('falls back to the dev example vendor without a manifest config', () => {
    renderAt('/payments');
    expect(lastProps?.config).toMatchObject({
      url: 'http://localhost:3990/payments/2.3.1/element.js',
      format: 'web-component',
      tagName: 'bright-checkout',
    });
  });
});
