import { act, renderHook } from '@testing-library/react';
import { useSubmit } from './useSubmit';

describe('useSubmit', () => {
  it('idle → submitting → success, returns the outcome', async () => {
    let finish!: (value: { id: string }) => void;
    const send = jest.fn(
      (_input: { days: number }) =>
        new Promise<{ id: string }>((resolve) => {
          finish = resolve;
        }),
    );
    const { result } = renderHook(() => useSubmit(send));
    expect(result.current.state.status).toBe('idle');
    let outcome: Promise<unknown> = Promise.resolve();
    act(() => {
      outcome = result.current.submit({ days: 2 });
    });
    expect(result.current.state.status).toBe('submitting');
    await act(async () => {
      finish({ id: 'LR-1' });
      await outcome;
    });
    expect(result.current.state).toEqual({
      status: 'success',
      data: { id: 'LR-1' },
    });
    await expect(outcome).resolves.toEqual({ ok: true, data: { id: 'LR-1' } });
    expect(send).toHaveBeenCalledWith({ days: 2 }, expect.any(AbortSignal));
  });

  it('resolves errors instead of throwing; reset() goes back to idle', async () => {
    const { result } = renderHook(() =>
      useSubmit(async () => {
        throw new Error('422 Unprocessable Entity');
      }),
    );
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.submit(undefined);
    });
    expect(outcome).toMatchObject({ ok: false, aborted: false });
    expect(result.current.state.status).toBe('error');
    act(() => result.current.reset());
    expect(result.current.state.status).toBe('idle');
  });

  it('aborts a running request on unmount', () => {
    let signal: AbortSignal | undefined;
    const { result, unmount } = renderHook(() =>
      useSubmit((_: void, s: AbortSignal) => {
        signal = s;
        return new Promise(() => {});
      }),
    );
    act(() => {
      void result.current.submit();
    });
    unmount();
    expect(signal?.aborted).toBe(true);
  });
});
