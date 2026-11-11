import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { API_NOT_CONFIGURED } from '@org/http-client';
import type { CreateItemMutation } from '@/hooks/useCreateItem';
import type { ItemsQuery } from '@/hooks/useItems';
import { DemoItems } from './DemoItems';

// A display component: the query and mutation results come in as props (the page calls the hooks).
function renderItems(query: Partial<ItemsQuery>) {
  const refetch = jest.fn();
  render(
    <DemoItems
      items={{ refetch, ...query } as unknown as ItemsQuery}
      createItem={
        { mutate: jest.fn(), isPending: false } as unknown as CreateItemMutation
      }
    />,
  );
  return { refetch };
}

describe('DemoItems', () => {
  it('shows loading', () => {
    renderItems({ status: 'pending' });
    expect(screen.getByRole('status')).toHaveTextContent('Loading items…');
  });

  it('shows the items and the add form', () => {
    renderItems({
      status: 'success',
      data: [{ id: 1, name: 'First', description: 'One' }],
    });
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText(/One/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add item' }),
    ).toBeInTheDocument();
  });

  it('shows an empty list', () => {
    renderItems({ status: 'success', data: [] });
    expect(screen.getByText('No items yet.')).toBeInTheDocument();
  });

  it('shows an error with a retry', async () => {
    const { refetch } = renderItems({
      status: 'error',
      error: new TypeError('Failed to fetch'),
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      /Could not load the items/,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('explains a missing settings.apiBaseUrl', () => {
    renderItems({ status: 'error', error: new Error(API_NOT_CONFIGURED) });
    expect(screen.getByText(/No API configured/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
