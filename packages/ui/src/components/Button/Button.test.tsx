import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole('button', { name: 'Go' })).toBeInTheDocument();
  });

  it('defaults to type="button" and applies variant classes', () => {
    render(<Button variant="secondary">Go</Button>);
    const button = screen.getByRole('button', { name: 'Go' });
    expect(button).toHaveAttribute('type', 'button');
    // identity-obj-proxy maps class names to their keys
    expect(button).toHaveClass('button', 'secondary');
  });

  it('calls onClick unless disabled', async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    const { rerender } = render(<Button onClick={onClick}>Go</Button>);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(
      <Button onClick={onClick} disabled>
        Go
      </Button>,
    );
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
