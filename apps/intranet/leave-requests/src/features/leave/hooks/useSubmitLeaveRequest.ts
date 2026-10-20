import { useAuth } from '@org/auth';
import { requireApiClient, useSubmit } from '@org/use-api';
import { useApiClient } from '@org/mf-runtime/remote';
import { submitLeaveRequest } from '../api';
import type { LeaveRequestInput } from '../types/leave';

/** POST a leave request, with the session's CSRF header when signed in (docs/auth-contract.md). */
export function useSubmitLeaveRequest() {
  const http = useApiClient();
  const { csrfToken, csrfHeaderName } = useAuth();
  return useSubmit(async (input: LeaveRequestInput, signal: AbortSignal) =>
    submitLeaveRequest(
      requireApiClient(http),
      input,
      signal,
      csrfToken ? { [csrfHeaderName]: csrfToken } : undefined,
    ),
  );
}
