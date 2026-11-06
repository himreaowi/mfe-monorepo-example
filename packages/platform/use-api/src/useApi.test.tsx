import { act, renderHook, waitFor } from '@testing-library/react';
import { useApi, type Loader } from './useApi';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useApi', () => {
  it('goes from loading to success', async () => {
    const load = jest.fn(async () => ['a', 'b']);
    const { result } = renderHook(() => useApi(load));
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current).toMatchObject({ data: ['a', 'b'] });
  });

  it('reports errors and loads again on reload()', async () => {
    let fail = true;
    const load = jest.fn(async () => {
      if (fail) throw new Error('500 Server Error');
      return 42;
    });
    const { result } = renderHook(() => useApi(load));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current).toMatchObject({
      error: expect.objectContaining({ message: '500 Server Error' }),
    });
    fail = false;
    act(() => result.current.reload());
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current).toMatchObject({ data: 42 }));
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('wraps non-Error rejections', async () => {
    const load = () => Promise.reject('plain string');
    const { result } = renderHook(() => useApi(load));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current).toMatchObject({
      error: expect.objectContaining({ message: 'plain string' }),
    });
  });

  it('aborts the previous request when the loader changes; stale results are ignored', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const signals: AbortSignal[] = [];
    const makeLoader =
      (d: ReturnType<typeof deferred<string>>): Loader<string> =>
      (signal) => {
        signals.push(signal);
        return d.promise;
      };
    const loadA = makeLoader(first);
    const loadB = makeLoader(second);
    const { result, rerender } = renderHook(({ load }) => useApi(load), {
      initialProps: { load: loadA },
    });
    rerender({ load: loadB });
    expect(signals[0].aborted).toBe(true);
    await act(async () => first.resolve('stale'));
    expect(result.current.status).toBe('loading');
    await act(async () => second.resolve('fresh'));
    expect(result.current).toMatchObject({ status: 'success', data: 'fresh' });
  });

  it('waits while the loader is null and aborts on unmount', async () => {
    const pending = deferred<number>();
    let signal: AbortSignal | undefined;
    const load: Loader<number> = (s) => {
      signal = s;
      return pending.promise;
    };
    const { result, rerender, unmount } = renderHook(
      ({ l }: { l: Loader<number> | null }) => useApi(l),
      { initialProps: { l: null as Loader<number> | null } },
    );
    expect(result.current.status).toBe('loading');
    expect(signal).toBeUndefined();
    rerender({ l: load });
    unmount();
    expect(signal?.aborted).toBe(true);
  });
});
