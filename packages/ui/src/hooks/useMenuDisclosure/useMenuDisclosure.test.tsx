import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router';
import { useMenuDisclosure } from './useMenuDisclosure';

/** A header with a Menu button and a panel (links + a button), like a shell layout. */
function Header({ withContainer = true }: { withContainer?: boolean }) {
  const menu = useMenuDisclosure();
  return (
    <header ref={withContainer ? menu.containerRef : undefined}>
      <span>Portal</span>
      <button {...menu.buttonProps}>Menu</button>
      <div
        {...menu.panelProps}
        data-testid="panel"
        className={menu.open ? 'open' : ''}
      >
        <nav aria-label="Main">
          <Link to="/">Home</Link>
          <Link to="/a">Alpha</Link>
        </nav>
        <button type="button">Use dark theme</button>
      </div>
    </header>
  );
}

function renderHeader(withContainer = true) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Header withContainer={withContainer} />
      <Routes>
        <Route index element={<p>home page</p>} />
        <Route path="a" element={<p>alpha page</p>} />
      </Routes>
      <p>outside</p>
    </MemoryRouter>,
  );
}

const button = () => screen.getByRole('button', { name: 'Menu' });

describe('useMenuDisclosure', () => {
  it('button controls the panel (aria-expanded, aria-controls) and toggles it', async () => {
    const user = userEvent.setup();
    renderHeader();
    const panel = screen.getByTestId('panel');
    expect(button()).toHaveAttribute('type', 'button');
    expect(button()).toHaveAttribute('aria-expanded', 'false');
    expect(button()).toHaveAttribute('aria-controls', panel.id);
    expect(panel.id).not.toBe('');
    await user.click(button());
    expect(button()).toHaveAttribute('aria-expanded', 'true');
    expect(panel).toHaveClass('open');
    await user.click(button());
    expect(button()).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on Escape and returns focus to the button', async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.click(button());
    await user.tab(); // into the panel
    expect(screen.getByTestId('panel')).toContainElement(
      document.activeElement as HTMLElement,
    );
    await user.keyboard('{Escape}');
    expect(button()).toHaveAttribute('aria-expanded', 'false');
    expect(button()).toHaveFocus();
  });

  it('closes after following a link inside, focus back on the button', async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.click(button());
    await user.click(screen.getByRole('link', { name: 'Alpha' }));
    expect(screen.getByText('alpha page')).toBeInTheDocument();
    expect(button()).toHaveAttribute('aria-expanded', 'false');
    expect(button()).toHaveFocus();
  });

  it('stays open after a click on a non-link control inside the panel', async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.click(button());
    await user.click(screen.getByRole('button', { name: 'Use dark theme' }));
    expect(button()).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes on a click outside the container, but not inside it; focus stays put', async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.click(button());
    await user.click(screen.getByText('Portal')); // inside the header
    expect(button()).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByText('outside'));
    expect(button()).toHaveAttribute('aria-expanded', 'false');
    expect(button()).not.toHaveFocus();
  });

  it('without a container, only button and panel count as inside', async () => {
    const user = userEvent.setup();
    renderHeader(false);
    await user.click(button());
    await user.click(screen.getByRole('button', { name: 'Use dark theme' }));
    expect(button()).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByText('Portal'));
    expect(button()).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on browser back/forward (popstate)', async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.click(button());
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(button()).toHaveAttribute('aria-expanded', 'false');
  });

  it('listens only while open (Escape on a closed menu does not move focus)', async () => {
    const user = userEvent.setup();
    renderHeader();
    screen.getByRole('link', { name: 'Home' }).focus();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('link', { name: 'Home' })).toHaveFocus();
  });
});
