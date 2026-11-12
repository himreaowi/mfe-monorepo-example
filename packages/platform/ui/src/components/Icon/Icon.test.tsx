import { render, screen } from '@testing-library/react';
import { CloseIcon, InfoIcon } from '../../index';
import { Icon } from './Icon';

describe('Icon', () => {
  it('is decorative without a label: aria-hidden, not focusable, currentColor', () => {
    const { container } = render(
      <Icon>
        <path d="M6 6l12 12" />
      </Icon>,
    );
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    expect(svg).toHaveAttribute('stroke', 'currentColor');
    expect(svg).not.toHaveAttribute('role');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('with a label: role img and an accessible name', () => {
    render(<InfoIcon label="Information" />);
    const img = screen.getByRole('img', { name: 'Information' });
    expect(img).not.toHaveAttribute('aria-hidden');
  });

  it('maps tone to a class; no tone keeps currentColor', () => {
    const { container, rerender } = render(<CloseIcon tone="danger" />);
    expect(container.querySelector('svg')).toHaveClass('icon', 'danger');
    rerender(<CloseIcon />);
    expect(container.querySelector('svg')?.getAttribute('class')).toBe('icon');
  });

  it('maps size to a class and passes other SVG props through', () => {
    const { container } = render(
      <CloseIcon
        size="lg"
        className="extra"
        data-testid="x"
        fill="currentColor"
      />,
    );
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('icon', 'lg', 'extra');
    expect(svg).toHaveAttribute('data-testid', 'x');
    expect(svg).toHaveAttribute('fill', 'currentColor');
  });
});
