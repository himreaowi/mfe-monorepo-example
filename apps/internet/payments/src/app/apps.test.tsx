import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { ExternalModuleProps } from '@org/mf-runtime/external';
import { ThemeProvider } from '@org/ui';
import { EmbeddedApp, StandaloneApp } from './apps';

let lastProps: ExternalModuleProps | undefined;
jest.mock('@org/mf-runtime/external', () => ({
  ExternalModule: (props: ExternalModuleProps) => {
    lastProps = props;
    return <div data-testid="external-module-stub" />;
  },
}));

describe('Payments external adapter remote', () => {
  it('embedded: mounts the vendor module below the shell mount with host props', () => {
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/payments/receipt/BP-1']}>
          <Routes>
            <Route
              path="payments/*"
              element={
                <EmbeddedApp
                  embedded
                  basePath="/payments"
                  user={{ id: 'u1', name: 'Shell User' }}
                  vendor={{ url: 'https://vendor.example/m.js', format: 'esm' }}
                />
              }
            />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Payments' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('external-module-stub')).toBeInTheDocument();
    expect(lastProps).toMatchObject({
      basePath: '/payments',
      path: 'receipt/BP-1',
      user: { id: 'u1', name: 'Shell User' },
      config: { url: 'https://vendor.example/m.js' },
    });
  });

  it('standalone: renders with its own chrome and the dev mock vendor', () => {
    window.history.pushState({}, '', '/');
    render(<StandaloneApp />);
    expect(screen.getByText('Payments (standalone)')).toBeInTheDocument();
    expect(lastProps?.config).toMatchObject({ format: 'web-component' });
  });
});
