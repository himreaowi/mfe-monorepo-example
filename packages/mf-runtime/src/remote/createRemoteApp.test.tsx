import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Navigate, Route, Routes } from 'react-router';
import { THEME_OWNER_ATTRIBUTE } from '@org/design-tokens';
import { ThemeProvider, ThemeToggle, useTheme } from '@org/ui';
import { createRemoteApp } from './createRemoteApp';
import { useHostProps, useRemotePath } from './HostPropsContext';

function Page({ name }: { name: string }) {
  const host = useHostProps();
  const to = useRemotePath();
  const { role } = useTheme();
  return (
    <div>
      <h1>{name}</h1>
      <span data-testid="embedded">{String(host.embedded)}</span>
      <span data-testid="base">{host.basePath}</span>
      <span data-testid="user">
        {(host.user as { id: string } | undefined)?.id}
      </span>
      <span data-testid="theme-role">{role}</span>
      <Link to={to('route-2')}>to route 2</Link>
    </div>
  );
}

const { EmbeddedApp, StandaloneApp } = createRemoteApp({
  routes: [
    { index: true, element: <Navigate to="route-1" replace /> },
    { path: 'route-1', element: <Page name="Route 1" /> },
    { path: 'route-2', element: <Page name="Route 2" /> },
  ],
  standaloneProps: { user: { id: 'mock-user' } },
  StandaloneLayout: ({ children }) => (
    <div data-testid="standalone-layout">
      <ThemeToggle />
      {children}
    </div>
  ),
});

const html = document.documentElement;

describe('createRemoteApp', () => {
  beforeEach(() => {
    localStorage.clear();
    html.removeAttribute(THEME_OWNER_ATTRIBUTE);
    html.removeAttribute('data-theme');
    window.history.replaceState(null, '', '/');
  });

  it('embedded: renders inside the shell router under the base path', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/apps/staff']}>
          <Routes>
            <Route
              path="apps/staff/*"
              element={
                <EmbeddedApp
                  embedded
                  basePath="/apps/staff"
                  user={{ id: 'u1' }}
                />
              }
            />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );
    // index route redirects relative to the mount
    expect(
      await screen.findByRole('heading', { name: 'Route 1' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('embedded')).toHaveTextContent('true');
    expect(screen.getByTestId('base')).toHaveTextContent('/apps/staff');
    expect(screen.getByTestId('user')).toHaveTextContent('u1');
    expect(screen.getByRole('link', { name: 'to route 2' })).toHaveAttribute(
      'href',
      '/apps/staff/route-2',
    );
    await user.click(screen.getByRole('link', { name: 'to route 2' }));
    expect(
      screen.getByRole('heading', { name: 'Route 2' }),
    ).toBeInTheDocument();
  });

  it("embedded: reuses the shell's ThemeProvider instead of owning the document", () => {
    const setAttribute = jest.spyOn(html, 'setAttribute');
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/apps/staff/route-1']}>
          <Routes>
            <Route
              path="apps/staff/*"
              element={<EmbeddedApp embedded basePath="/apps/staff" />}
            />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );
    expect(screen.getByTestId('theme-role')).toHaveTextContent('root');
    const ownerWrites = setAttribute.mock.calls.filter(
      ([n]) => n === THEME_OWNER_ATTRIBUTE,
    );
    expect(ownerWrites).toHaveLength(1); // only the shell's provider
    setAttribute.mockRestore();
  });

  it('embedded without a surrounding router: creates one with basename = basePath', async () => {
    window.history.replaceState(null, '', '/widgets/staff/route-2');
    render(<EmbeddedApp embedded basePath="/widgets/staff" />);
    expect(
      await screen.findByRole('heading', { name: 'Route 2' }),
    ).toBeInTheDocument();
  });

  it('standalone: own router from /, own theme, mock host props, layout', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/route-1');
    render(<StandaloneApp />);
    expect(screen.getByTestId('standalone-layout')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Route 1' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('embedded')).toHaveTextContent('false');
    expect(screen.getByTestId('base')).toHaveTextContent('/');
    expect(screen.getByTestId('user')).toHaveTextContent('mock-user');
    expect(screen.getByTestId('theme-role')).toHaveTextContent('root');
    expect(html.hasAttribute(THEME_OWNER_ATTRIBUTE)).toBe(true);
    await user.click(screen.getByLabelText('Use dark theme'));
    expect(html.getAttribute('data-theme')).toBe('dark');
    await user.click(screen.getByRole('link', { name: 'to route 2' }));
    expect(window.location.pathname).toBe('/route-2');
  });
});
