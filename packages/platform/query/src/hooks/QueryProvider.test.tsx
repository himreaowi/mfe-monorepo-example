// Here, not next to QueryProvider.tsx: useQuery may only be imported in hooks/ folders.
import { act, render, screen, waitFor } from '@testing-library/react';
import { useQuery, type QueryClient } from '@tanstack/react-query';
import { createQueryClient, QueryProvider } from '../index';

function Secret({ load }: { load: () => Promise<string> }) {
  const { data } = useQuery({ queryKey: ['secret'], queryFn: load });
  return <p data-testid="secret">{data ?? 'none'}</p>;
}

function app(
  client: QueryClient,
  userId: string | null | undefined,
  load: () => Promise<string>,
) {
  return (
    <QueryProvider client={client} userId={userId}>
      <Secret load={load} />
    </QueryProvider>
  );
}

describe('QueryProvider', () => {
  it('clears the cache when the user changes; the next user never sees old data', async () => {
    const client = createQueryClient();
    const load = jest
      .fn()
      .mockResolvedValueOnce('of ada')
      .mockResolvedValueOnce('of bob');
    const seen: Array<string | null> = [];
    const { rerender } = render(app(client, 'ada', load));
    await screen.findByText('of ada');

    const observer = new MutationObserver(() =>
      seen.push(screen.getByTestId('secret').textContent),
    );
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
    });
    rerender(app(client, 'bob', load));
    // synchronously after the render: the old data is gone already
    expect(screen.getByTestId('secret')).toHaveTextContent('none');
    await screen.findByText('of bob');
    observer.disconnect();
    expect(seen).not.toContain('of ada');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('also updates a mounted component that does not re-render with the provider', async () => {
    const client = createQueryClient();
    const load = jest
      .fn()
      .mockResolvedValueOnce('of ada')
      .mockResolvedValueOnce('of bob');
    const page = <Secret load={load} />; // same element: React skips it on a re-render
    const tree = (userId: string) => (
      <QueryProvider client={client} userId={userId}>
        {page}
      </QueryProvider>
    );
    const { rerender } = render(tree('ada'));
    await screen.findByText('of ada');
    rerender(tree('bob'));
    await screen.findByText('of bob');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('clears on sign-out, also when nothing was mounted at that moment', async () => {
    const client = createQueryClient();
    const load = jest.fn().mockResolvedValue('data');
    const first = render(app(client, 'ada', load));
    await screen.findByText('data');
    first.unmount();
    expect(client.getQueryData(['secret'])).toBe('data');

    render(
      app(
        client,
        null,
        jest.fn(() => new Promise<string>(() => {})),
      ),
    );
    expect(screen.getByTestId('secret')).toHaveTextContent('none');
  });

  it('keeps the cache when the same user comes back or re-renders', async () => {
    const client = createQueryClient();
    const load = jest.fn().mockResolvedValue('data');
    const first = render(app(client, 'ada', load));
    await screen.findByText('data');
    first.rerender(app(client, 'ada', load));
    first.unmount();
    render(app(client, 'ada', load));
    expect(screen.getByTestId('secret')).toHaveTextContent('data');
    await act(async () => {});
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('treats undefined and null as the same: no user', async () => {
    const client = createQueryClient();
    const load = jest.fn().mockResolvedValue('public');
    const { rerender } = render(app(client, undefined, load));
    await screen.findByText('public');
    rerender(app(client, null, load));
    await waitFor(() =>
      expect(screen.getByTestId('secret')).toHaveTextContent('public'),
    );
    expect(load).toHaveBeenCalledTimes(1);
  });
});
