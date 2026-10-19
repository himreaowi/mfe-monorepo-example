import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { useOnlineStatus } from '@org/pwa';
import { ThemeProvider } from '@org/ui';
import { APP_TITLE } from '@/core/constants/app';
import type { RemoteEntry } from '@/core/types/remotes';
import { ShellLayout } from './ShellLayout';

jest.mock('@org/pwa', () => ({ useOnlineStatus: jest.fn(() => true) }));
// the user menu needs an AuthProvider; a stand-in keeps these tests about the layout
jest.mock('@org/auth', () => ({
  UserMenu: () => <button type="button">Sign in</button>,
}));

const remotes: RemoteEntry[] = [
  {
    name: 'alpha',
    title: 'Alpha',
    path: '/alpha',
    federationName: 'internet_alpha',
    package: '@org/internet-alpha',
    access: 'public',
    kind: 'react',
  },
];

function renderLayout() {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<ShellLayout remotes={remotes} />}>
            <Route index element={<p>home page</p>} />
            <Route path="alpha" element={<p>alpha page</p>} />
          </Route>
        </Routes>
        <p>outside</p>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

const menuButton = () => screen.getByRole('button', { name: 'Menu' });

describe('ShellLayout', () => {
  it('renders brand, nav, theme toggle, user menu and the routed page', () => {
    renderLayout();
    expect(screen.getByTestId('header-brand')).toHaveTextContent(APP_TITLE);
    expect(screen.getByRole('list', { name: 'Apps' })).toBeInTheDocument();
    expect(screen.getByLabelText('Use dark theme')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('home page');
    expect(screen.queryByTestId('connection-required')).not.toBeInTheDocument();
    expect(screen.getByTestId('main-header')).toHaveAttribute(
      'data-nav-placement',
      'top',
    );
  });

  it('shows the connection banner when offline', () => {
    jest.mocked(useOnlineStatus).mockReturnValueOnce(false);
    renderLayout();
    expect(screen.getByTestId('connection-required')).toBeInTheDocument();
  });

  it('landmarks: one banner holding the named nav, one main', () => {
    renderLayout();
    const banner = screen.getByRole('banner');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(banner).toContainElement(nav);
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('main')).not.toContainElement(nav);
  });

  it('skip link: first Tab stop, moves focus to main without leaving the route', async () => {
    const user = userEvent.setup();
    renderLayout();
    await user.tab();
    const skip = screen.getByRole('link', { name: 'Skip to main content' });
    expect(skip).toHaveFocus();
    const main = screen.getByRole('main');
    expect(skip).toHaveAttribute('href', `#${main.id}`);
    expect(main).toHaveAttribute('tabindex', '-1');
    await user.keyboard('{Enter}');
    expect(main).toHaveFocus();
    expect(main).toHaveTextContent('home page');
  });

  it('Menu button controls the panel with nav, theme toggle and user menu', async () => {
    const user = userEvent.setup();
    renderLayout();
    const panel = screen.getByTestId('header-panel');
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
    expect(menuButton()).toHaveAttribute('aria-controls', panel.id);
    expect(panel).toContainElement(
      screen.getByRole('navigation', { name: 'Main' }),
    );
    expect(panel).toContainElement(screen.getByLabelText('Use dark theme'));
    expect(panel).toContainElement(
      screen.getByRole('button', { name: 'Sign in' }),
    );
    // nav first, then theme toggle and user menu (keyboard order = visual order)
    const order = [...panel.querySelectorAll('a, button')].map(
      (el) => el.textContent,
    );
    expect(order.indexOf('Home')).toBeLessThan(order.indexOf('Sign in'));
    await user.click(menuButton());
    expect(menuButton()).toHaveAttribute('aria-expanded', 'true');
    expect(panel).toHaveClass('open');
  });

  it('the panel closes on Escape (focus back), a followed link, an outside click and back/forward', async () => {
    const user = userEvent.setup();
    renderLayout();
    await user.click(menuButton());
    await user.tab();
    await user.keyboard('{Escape}');
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
    expect(menuButton()).toHaveFocus();
    await user.click(menuButton());
    await user.click(screen.getByRole('link', { name: 'Alpha' }));
    expect(screen.getByRole('main')).toHaveTextContent('alpha page');
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
    await user.click(menuButton());
    await user.click(screen.getByLabelText('Use dark theme'));
    expect(menuButton()).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByText('outside'));
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
    await user.click(menuButton());
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
  });

  it('measures the header: wide when the row fits, compact when it does not', () => {
    const size = { available: 1280, required: 900 };
    class FakeResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver =
      FakeResizeObserver;
    const spy = jest
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        const width =
          this.getAttribute('data-layout') === 'measure'
            ? size.required
            : size.available;
        return { width, height: 60, toJSON: () => ({}) } as DOMRect;
      });
    try {
      const first = renderLayout();
      expect(screen.getByTestId('main-header')).toHaveAttribute(
        'data-layout',
        'wide',
      );
      first.unmount();
      size.required = 1400;
      renderLayout();
      expect(screen.getByTestId('main-header')).toHaveAttribute(
        'data-layout',
        'compact',
      );
    } finally {
      spy.mockRestore();
      delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
    }
  });

  it('header colours: one block of --header-* values, mapped onto the page tokens', () => {
    const scss = readFileSync(
      join(__dirname, 'ShellLayout.module.scss'),
      'utf8',
    );
    for (const name of [
      'bg',
      'text',
      'text-muted',
      'border',
      'accent',
      'on-accent',
      'hover',
    ]) {
      expect(scss).toMatch(new RegExp(`^  --header-${name}: `, 'm'));
    }
    expect(scss).toMatch(/^ {2}--color-surface: var\(--header-bg\);$/m);
    expect(scss).toMatch(/^ {2}--color-bg: var\(--header-hover\);$/m);
  });
});
