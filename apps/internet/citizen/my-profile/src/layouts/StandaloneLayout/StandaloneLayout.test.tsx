import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { ThemeProvider } from '@org/ui';
import { StandaloneLayout } from './StandaloneLayout';

function renderLayout() {
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <StandaloneLayout>
          <h1>Page</h1>
        </StandaloneLayout>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('StandaloneLayout', () => {
  it('has a banner with brand, page links and the theme toggle, and one main', () => {
    renderLayout();
    const banner = screen.getByRole('banner');
    expect(banner).toHaveTextContent('(standalone)');
    expect(
      screen.getByRole('navigation', { name: 'Main' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute(
      'href',
      '/',
    );
    expect(
      screen.getByRole('button', { name: 'Use dark theme' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('Page');
  });

  it('skip link is the first Tab stop and focuses main', async () => {
    const user = userEvent.setup();
    renderLayout();
    await user.tab();
    expect(
      screen.getByRole('link', { name: 'Skip to main content' }),
    ).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('main')).toHaveFocus();
  });
});
