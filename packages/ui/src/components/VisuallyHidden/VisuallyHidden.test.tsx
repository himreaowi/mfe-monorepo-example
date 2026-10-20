import { render, screen } from '@testing-library/react';
import { VisuallyHidden } from './VisuallyHidden';

describe('VisuallyHidden', () => {
  it('keeps the text in the accessibility tree', () => {
    render(
      <button type="button">
        <VisuallyHidden>Close dialog</VisuallyHidden>×
      </button>,
    );
    expect(
      screen.getByRole('button', { name: 'Close dialog ×' }),
    ).toBeVisible();
    expect(screen.getByText('Close dialog')).toHaveClass('visuallyHidden');
  });
});
