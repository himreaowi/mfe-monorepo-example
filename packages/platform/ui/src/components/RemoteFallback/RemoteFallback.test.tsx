import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RemoteFallback } from './RemoteFallback';

describe('RemoteFallback', () => {
  it('shows alert fallback', () => {
    render(<RemoteFallback reason="unreachable" />);
    expect(screen.getByTestId('remote-fallback')).toHaveTextContent(
      'unreachable',
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('offers a retry button when onRetry is given', async () => {
    const user = userEvent.setup();
    const onRetry = jest.fn();
    render(<RemoteFallback onRetry={onRetry} />);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
