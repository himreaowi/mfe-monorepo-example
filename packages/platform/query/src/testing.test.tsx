import { screen } from '@testing-library/react';
import { useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  createTestQueryClient,
  renderHookWithQuery,
  renderWithQuery,
} from './testing';

function Probe() {
  const client = useQueryClient();
  return <p>{String(client.getDefaultOptions().queries?.retry)}</p>;
}

describe('test helpers', () => {
  it('createTestQueryClient keeps the defaults but does not retry', () => {
    const { queries } = createTestQueryClient().getDefaultOptions();
    expect(queries).toMatchObject({ retry: false, staleTime: 30_000 });
  });

  it('renderWithQuery provides a client, returns it, and nests a wrapper inside', () => {
    function Host({ children }: { children: ReactNode }) {
      return <div data-testid="host">{children}</div>;
    }
    const { queryClient } = renderWithQuery(<Probe />, { wrapper: Host });
    expect(screen.getByTestId('host')).toHaveTextContent('false');
    expect(queryClient.getDefaultOptions().queries?.retry).toBe(false);
  });

  it('renderHookWithQuery uses the client it was given', () => {
    const queryClient = createTestQueryClient();
    const { result } = renderHookWithQuery(() => useQueryClient(), {
      queryClient,
    });
    expect(result.current).toBe(queryClient);
  });
});
