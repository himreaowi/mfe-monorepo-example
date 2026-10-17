import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { THEME_STORAGE_KEY } from '@org/design-tokens';
import { ThemeProvider } from '../../providers/ThemeProvider';
import { ThemeToggle } from './ThemeToggle';

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('toggles light/dark and exposes use-system control', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    await user.click(screen.getByLabelText('Use dark theme'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(screen.getByLabelText('Use dark theme')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByLabelText('Use system theme'));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });
});
