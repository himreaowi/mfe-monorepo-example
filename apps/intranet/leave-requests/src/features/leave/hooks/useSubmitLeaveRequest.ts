import { useAuth } from '@org/auth';
import { useSubmit } from '@org/use-api';
import { useApiClient } from '@/services/http';
import { submitLeaveRequest } from '../api';
import type { LeaveRequestInput } from '../types/leave';

/** POST a leave request, with the session's CSRF header when signed in (docs/auth-contract.md). */
export function useSubmitLeaveRequest() {
  const http = useApiClient();
  const { csrfToken, csrfHeaderName } = useAuth();
  return useSubmit((input: LeaveRequestInput, signal: AbortSignal) =>
    submitLeaveRequest(
      http,
      input,
      signal,
      csrfToken ? { [csrfHeaderName]: csrfToken } : undefined,
    ),
  );
}
