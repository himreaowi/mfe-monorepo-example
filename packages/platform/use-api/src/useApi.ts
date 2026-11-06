import { useCallback, useEffect, useState } from 'react';

/** Loads data. Must reject with an `Error` and stop when `signal` aborts. */
export type Loader<T> = (signal: AbortSignal) => Promise<T>;

export type ApiState<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };

export type ApiResult<T> = ApiState<T> & {
  /** Load again (e.g. a "Try again" button). */
  reload: () => void;
};

type Settled<T> = {
  load: Loader<T>;
  attempt: number;
  state: ApiState<T>;
};

const LOADING = { status: 'loading' } as const;

export function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/**
 * Run `load` and expose loading / success / error. Re-runs when `load` changes (wrap it in
 * `useCallback` with its inputs as dependencies) or on `reload()`. The previous request is
 * aborted on change and on unmount, and a stale response never overwrites a newer one.
 * Pass `null` to wait (e.g. until an id is known).
 *
 *   const load = useCallback((signal) => getStaffMember(http, id, signal), [http, id]);
 *   const staff = useApi(load);
 */
export function useApi<T>(load: Loader<T> | null): ApiResult<T> {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);

  useEffect(() => {
    if (!load) return undefined;
    const controller = new AbortController();
    const settle = (state: ApiState<T>) => {
      if (!controller.signal.aborted) setSettled({ load, attempt, state });
    };
    load(controller.signal).then(
      (data) => settle({ status: 'success', data }),
      (error: unknown) => settle({ status: 'error', error: toError(error) }),
    );
    return () => controller.abort();
  }, [load, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const current =
    settled && settled.load === load && settled.attempt === attempt
      ? settled.state
      : LOADING;
  return { ...current, reload };
}
