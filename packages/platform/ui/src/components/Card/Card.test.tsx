import { render, screen } from '@testing-library/react';
import { Card } from './Card';

describe('Card', () => {
  it('renders title, content and footer', () => {
    render(
      <Card
        title="Leave balance"
        headingLevel={3}
        footer={<a href="/x">More</a>}
      >
        <p>12 days</p>
      </Card>,
    );
    expect(
      screen.getByRole('heading', { level: 3, name: 'Leave balance' }),
    ).toBeInTheDocument();
    expect(screen.getByText('12 days')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'More' })).toBeInTheDocument();
  });

  it('renders as another element with attributes passed through', () => {
    render(
      <ul>
        <Card as="li" className="x" data-testid="card">
          Item
        </Card>
      </ul>,
    );
    const card = screen.getByTestId('card');
    expect(card.tagName).toBe('LI');
    expect(card).toHaveClass('card', 'x');
  });
});
