import { render, screen } from '@testing-library/react';
import { Spinner } from './Spinner';

describe('Spinner', () => {
  it('is a status region named by its label', () => {
    render(<Spinner label="Loading items…" />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Loading items…');
    expect(screen.getByText('Loading items…')).toHaveClass('visuallyHidden');
  });

  it('can show the label', () => {
    render(<Spinner labelVisible size="lg" />);
    expect(screen.getByText('Loading…')).toHaveClass('label');
  });

  it('decorative: hidden from assistive technology', () => {
    const { container } = render(<Spinner decorative />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });
});
