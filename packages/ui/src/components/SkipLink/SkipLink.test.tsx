import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SkipLink } from './SkipLink';

function renderPage(label?: string) {
  return render(
    <>
      <SkipLink targetId="content">{label}</SkipLink>
      <button type="button">Header button</button>
      <main id="content" tabIndex={-1}>
        page
      </main>
    </>,
  );
}

describe('SkipLink', () => {
  it('is the first Tab stop and focuses the target without a URL change', async () => {
    const user = userEvent.setup();
    const before = window.location.href;
    renderPage();
    await user.tab();
    const link = screen.getByRole('link', { name: 'Skip to main content' });
    expect(link).toHaveFocus();
    expect(link).toHaveAttribute('href', '#content');
    await user.keyboard('{Enter}');
    expect(screen.getByRole('main')).toHaveFocus();
    expect(window.location.href).toBe(before);
  });

  it('takes its text from children and adds a class', () => {
    render(
      <SkipLink targetId="x" className="extra">
        Zum Inhalt
      </SkipLink>,
    );
    const link = screen.getByRole('link', { name: 'Zum Inhalt' });
    expect(link).toHaveClass('skipLink');
    expect(link).toHaveClass('extra');
  });

  it('does nothing when the target is missing', async () => {
    const user = userEvent.setup();
    render(<SkipLink targetId="missing" />);
    await user.click(screen.getByRole('link'));
    expect(screen.getByRole('link')).toHaveFocus();
  });
});
