import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ItemsState } from '../../hooks/useItems';
import { DemoItems } from './DemoItems';

// A display component: states and callbacks come in as props (the page calls the hooks).
function renderItems(state: ItemsState) {
  const props = {
    state,
    onRetry: jest.fn(),
    onCreate: jest.fn(),
    onCreated: jest.fn(),
  };
  render(<DemoItems {...props} />);
  return props;
}

describe('DemoItems', () => {
  it('shows loading', () => {
    renderItems({ status: 'loading' });
    expect(screen.getByRole('status')).toHaveTextContent('Loading items…');
  });

  it('shows the items and the add form', () => {
    renderItems({
      status: 'success',
      items: [{ id: 1, name: 'First', description: 'One' }],
    });
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText(/One/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add item' }),
    ).toBeInTheDocument();
  });

  it('shows an empty list', () => {
    renderItems({ status: 'success', items: [] });
    expect(screen.getByText('No items yet.')).toBeInTheDocument();
  });

  it('shows an error with a retry', async () => {
    const { onRetry } = renderItems({
      status: 'error',
      message: 'Could not load the items. Check your connection and try again.',
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      /Could not load the items/,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('explains a missing settings.apiBaseUrl', () => {
    renderItems({ status: 'unconfigured' });
    expect(screen.getByText(/No API configured/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
