import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  THEME_OWNER_ATTRIBUTE,
  THEME_REQUEST_EVENT,
  THEME_STORAGE_KEY,
} from '@org/design-tokens';
import { ThemeProvider, useTheme } from './ThemeProvider';

function Probe({ id = '' }: { id?: string }) {
  const { theme, setTheme, useSystemTheme, preference, role } = useTheme();
  return (
    <div>
      <span data-testid={`theme${id}`}>{theme}</span>
      <span data-testid={`preference${id}`}>{preference}</span>
      <span data-testid={`role${id}`}>{role}</span>
      <button type="button" onClick={() => setTheme('dark')}>
        dark{id}
      </button>
      <button type="button" onClick={() => setTheme('light')}>
        light{id}
      </button>
      <button type="button" onClick={useSystemTheme}>
        system{id}
      </button>
    </div>
  );
}

const html = document.documentElement;

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    html.removeAttribute('data-theme');
    html.removeAttribute('data-theme-preference');
    html.removeAttribute(THEME_OWNER_ATTRIBUTE);
  });

  it('first visit uses system preference (matchMedia false → light)', () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('preference')).toHaveTextContent('system');
    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    expect(screen.getByTestId('role')).toHaveTextContent('root');
    expect(html.getAttribute('data-theme')).toBe('light');
  });

  it('persists light/dark toggle to localStorage', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await user.click(screen.getByText('dark'));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(html.getAttribute('data-theme')).toBe('dark');
  });

  it('Use system theme clears persistence', async () => {
    const user = userEvent.setup();
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    await user.click(screen.getByText('system'));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(screen.getByTestId('preference')).toHaveTextContent('system');
  });

  it('marks <html> as owned while mounted', () => {
    const { unmount } = render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(html.hasAttribute(THEME_OWNER_ATTRIBUTE)).toBe(true);
    unmount();
    expect(html.hasAttribute(THEME_OWNER_ATTRIBUTE)).toBe(false);
  });

  describe('embedded (remote inside a shell)', () => {
    it('a nested provider reuses the parent theme instead of creating its own', async () => {
      const user = userEvent.setup();
      render(
        <ThemeProvider>
          <Probe id="-shell" />
          <ThemeProvider>
            <Probe id="-remote" />
          </ThemeProvider>
        </ThemeProvider>,
      );
      expect(screen.getByTestId('role-remote')).toHaveTextContent('root');
      // the remote toggles the shell theme: one source of truth
      await user.click(screen.getByText('dark-remote'));
      expect(screen.getByTestId('theme-shell')).toHaveTextContent('dark');
      expect(screen.getByTestId('theme-remote')).toHaveTextContent('dark');
      expect(html.getAttribute('data-theme')).toBe('dark');
    });

    it('follows a document owned by another provider instance (e.g. unshared @org/ui)', async () => {
      const user = userEvent.setup();
      html.setAttribute(THEME_OWNER_ATTRIBUTE, 'other-instance');
      html.setAttribute('data-theme', 'dark');
      html.setAttribute('data-theme-preference', 'dark');
      const requests: unknown[] = [];
      const onRequest = (e: Event) => requests.push((e as CustomEvent).detail);
      document.addEventListener(THEME_REQUEST_EVENT, onRequest);

      render(
        <ThemeProvider>
          <Probe />
        </ThemeProvider>,
      );
      expect(screen.getByTestId('role')).toHaveTextContent('follower');
      expect(screen.getByTestId('theme')).toHaveTextContent('dark');

      // forwards changes to the owner, never writes itself
      await user.click(screen.getByText('light'));
      expect(requests).toEqual([{ preference: 'light' }]);
      expect(html.getAttribute('data-theme')).toBe('dark');
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();

      // mirrors the owner's change
      await act(async () => {
        html.setAttribute('data-theme', 'light');
      });
      expect(screen.getByTestId('theme')).toHaveTextContent('light');
      expect(html.getAttribute(THEME_OWNER_ATTRIBUTE)).toBe('other-instance');
      document.removeEventListener(THEME_REQUEST_EVENT, onRequest);
    });

    it('the owner applies theme requests from followers', async () => {
      render(
        <ThemeProvider>
          <Probe />
        </ThemeProvider>,
      );
      await act(async () => {
        document.dispatchEvent(
          new CustomEvent(THEME_REQUEST_EVENT, {
            detail: { preference: 'dark' },
          }),
        );
      });
      expect(screen.getByTestId('theme')).toHaveTextContent('dark');
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    });
  });

  it('useTheme outside a provider throws', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/within ThemeProvider/);
    spy.mockRestore();
  });
});
