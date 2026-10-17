import { useCallback, useEffect, useRef, useState } from 'react';
import { toError } from './useApi';

export type SubmitState<T> =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };

export type SubmitOutcome<T> =
  { ok: true; data: T } | { ok: false; error: Error; aborted: boolean };

export type SubmitResult<TInput, T> = {
  state: SubmitState<T>;
  /** Send `input`. Resolves (never rejects) with the outcome, so callers can map field errors. */
  submit: (input: TInput) => Promise<SubmitOutcome<T>>;
  /** Back to `idle` (e.g. after the user edits the form again). */
  reset: () => void;
};

/**
 * State-changing requests (POST/PUT/DELETE) from event handlers: idle → submitting →
 * success | error. A second submit while one is running aborts the first; unmounting aborts
 * a running one and ignores its result.
 *
 *   const save = useSubmit((input: LeaveInput, signal) => submitLeaveRequest(http, input, signal));
 *   const outcome = await save.submit(values);
 */
export function useSubmit<TInput, T>(
  send: (input: TInput, signal: AbortSignal) => Promise<T>,
): SubmitResult<TInput, T> {
  const [state, setState] = useState<SubmitState<T>>({ status: 'idle' });
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const submit = useCallback(
    async (input: TInput): Promise<SubmitOutcome<T>> => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setState({ status: 'submitting' });
      try {
        const data = await send(input, controller.signal);
        if (controller.signal.aborted) {
          return { ok: false, error: new Error('Aborted'), aborted: true };
        }
        setState({ status: 'success', data });
        return { ok: true, data };
      } catch (caught) {
        const error = toError(caught);
        if (controller.signal.aborted)
          return { ok: false, error, aborted: true };
        setState({ status: 'error', error });
        return { ok: false, error, aborted: false };
      }
    },
    [send],
  );

  const reset = useCallback(() => setState({ status: 'idle' }), []);
  return { state, submit, reset };
}
