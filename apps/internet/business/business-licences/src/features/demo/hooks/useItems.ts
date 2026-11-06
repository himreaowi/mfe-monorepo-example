import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from '@org/mf-runtime/remote';
import { describeError, listItems } from '../api/itemsApi';
import type { Item } from '../types/item';

export type ItemsState =
  | { status: 'unconfigured' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; items: Item[] };

/**
 * Loads the item list (loading / success / error), aborts on unmount or when the API changes,
 * `reload()` retries, `add(item)` shows a newly created item without refetching.
 */
export function useItems() {
  const http = useApiClient();
  const [state, setState] = useState<ItemsState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!http) return undefined;
    const controller = new AbortController();
    setState({ status: 'loading' });
    listItems(http, controller.signal).then(
      (items) => setState({ status: 'success', items }),
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: 'error',
          message: describeError(error, 'Could not load the items'),
        });
      },
    );
    return () => controller.abort();
  }, [http, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const add = useCallback(
    (item: Item) =>
      setState((current) =>
        current.status === 'success'
          ? { status: 'success', items: [...current.items, item] }
          : current,
      ),
    [],
  );

  return {
    state: http ? state : ({ status: 'unconfigured' } as const),
    reload,
    add,
  };
}
