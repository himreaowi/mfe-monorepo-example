import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { Link } from './Link';

describe('Link', () => {
  it('to: navigates with the router (no page load)', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<Link to="/details">Details</Link>} />
          <Route path="/details" element={<h1>Details page</h1>} />
        </Routes>
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: 'Details' });
    expect(link).toHaveAttribute('href', '/details');
    expect(link).toHaveClass('link');
    await user.click(link);
    expect(
      screen.getByRole('heading', { name: 'Details page' }),
    ).toBeInTheDocument();
  });

  it('href: a plain anchor with the ref and attributes passed through', () => {
    const ref = createRef<HTMLAnchorElement>();
    render(
      <Link ref={ref} href="mailto:help@example.org" className="x">
        Email us
      </Link>,
    );
    const link = screen.getByRole('link', { name: 'Email us' });
    expect(ref.current).toBe(link);
    expect(link).toHaveAttribute('href', 'mailto:help@example.org');
    expect(link).toHaveClass('link', 'x');
    expect(link).not.toHaveAttribute('target');
  });

  it('newTab: opens safely in a new tab and says so', () => {
    render(
      <Link href="https://example.org" newTab>
        Example
      </Link>,
    );
    const link = screen.getByRole('link', {
      name: 'Example (opens in a new tab)',
    });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
