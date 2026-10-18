import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router';
import { ThemeProvider } from '../../providers/ThemeProvider';
import { MainLayout } from './MainLayout';

function renderLayout() {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            element={
              <MainLayout
                brand="Portal"
                nav={
                  <ul aria-label="Apps">
                    <li>
                      <Link to="/">Home</Link>
                    </li>
                    <li>
                      <Link to="/a">Alpha</Link>
                    </li>
                  </ul>
                }
                headerActions={<button type="button">Sign in</button>}
              />
            }
          >
            <Route index element={<p>home page</p>} />
            <Route path="a" element={<p>alpha page</p>} />
          </Route>
        </Routes>
        <p>outside</p>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('MainLayout', () => {
  it('renders brand, theme toggle and the routed page via <Outlet />', () => {
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route element={<MainLayout brand="Portal" />}>
              <Route index element={<p>home page</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );
    expect(screen.getByText('Portal')).toBeInTheDocument();
    expect(screen.getByLabelText('Use dark theme')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('home page');
    expect(screen.queryByTestId('connection-required')).not.toBeInTheDocument();
  });

  it('shows the connection banner when offline', () => {
    render(
      <ThemeProvider>
        <MainLayout online={false}>
          <p>content</p>
        </MainLayout>
      </ThemeProvider>,
    );
    expect(screen.getByTestId('connection-required')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('content');
  });

  it('has a Menu disclosure controlling the panel with nav, theme toggle and actions', async () => {
    const user = userEvent.setup();
    renderLayout();
    const button = screen.getByRole('button', { name: 'Menu' });
    const panel = screen.getByTestId('header-panel');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('aria-controls', panel.id);
    expect(panel).toContainElement(
      screen.getByRole('navigation', { name: 'Main' }),
    );
    expect(panel).toContainElement(screen.getByLabelText('Use dark theme'));
    expect(panel).toContainElement(
      screen.getByRole('button', { name: 'Sign in' }),
    );
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(panel.className).toMatch(/open/);
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on Escape and returns focus to the button', async () => {
    const user = userEvent.setup();
    renderLayout();
    const button = screen.getByRole('button', { name: 'Menu' });
    await user.click(button);
    await user.tab(); // into the panel
    expect(screen.getByTestId('header-panel')).toContainElement(
      document.activeElement as HTMLElement,
    );
    await user.keyboard('{Escape}');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
  });

  it('closes after following a link inside, focus back on the button', async () => {
    const user = userEvent.setup();
    renderLayout();
    const button = screen.getByRole('button', { name: 'Menu' });
    await user.click(button);
    await user.click(screen.getByRole('link', { name: 'Alpha' }));
    expect(screen.getByRole('main')).toHaveTextContent('alpha page');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
  });

  it('closes on a click outside the header, but not inside it', async () => {
    const user = userEvent.setup();
    renderLayout();
    const button = screen.getByRole('button', { name: 'Menu' });
    await user.click(button);
    await user.click(screen.getByLabelText('Use dark theme'));
    expect(button).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByText('outside'));
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).not.toHaveFocus();
  });

  it('labels the menu button and nav landmark when asked', () => {
    render(
      <ThemeProvider>
        <MainLayout nav={<a href="/x">X</a>} navLabel="Apps" menuLabel="Browse">
          <p>content</p>
        </MainLayout>
      </ThemeProvider>,
    );
    expect(screen.getByRole('button', { name: 'Browse' })).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Apps' }),
    ).toBeInTheDocument();
  });
});
