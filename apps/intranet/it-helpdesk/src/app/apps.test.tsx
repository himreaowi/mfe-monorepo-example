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

describe('It Helpdesk external adapter remote', () => {
  it('embedded: mounts the vendor module below the shell mount with host props', () => {
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/it-helpdesk/receipt/1']}>
          <Routes>
            <Route
              path="it-helpdesk/*"
              element={
                <EmbeddedApp
                  embedded
                  basePath="/it-helpdesk"
                  user={{ id: 'u1', name: 'Shell User' }}
                  vendor={{ url: 'https://vendor.example/m.js', format: 'esm' }}
                />
              }
            />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );
    expect(screen.getByTestId('mode-badge')).toHaveTextContent('Embedded');
    expect(screen.getByTestId('external-module-stub')).toBeInTheDocument();
    expect(lastProps).toMatchObject({
      basePath: '/it-helpdesk',
      path: 'receipt/1',
      user: { id: 'u1', name: 'Shell User' },
      config: { url: 'https://vendor.example/m.js' },
    });
  });

  it('standalone: renders with its own chrome and the dev mock vendor', () => {
    window.history.pushState({}, '', '/');
    render(<StandaloneApp />);
    expect(screen.getByTestId('mode-badge')).toHaveTextContent('Standalone');
    expect(lastProps?.config).toMatchObject({ format: 'esm' });
  });
});
