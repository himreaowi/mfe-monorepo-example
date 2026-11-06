import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders its text with the variant class', () => {
    render(
      <Badge variant="success" data-testid="status">
        Approved
      </Badge>,
    );
    expect(screen.getByTestId('status')).toHaveTextContent('Approved');
    expect(screen.getByTestId('status')).toHaveClass('badge', 'success');
  });

  it('defaults to neutral', () => {
    render(<Badge>Draft</Badge>);
    expect(screen.getByText('Draft')).toHaveClass('neutral');
  });
});
