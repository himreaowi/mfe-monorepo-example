import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@org/auth';
import { requireApiClient } from '@org/http-client';
import { useApiClient } from '@org/mf-runtime/remote';
import { submitLeaveRequest } from '@/api/leaveApi';
import { leaveKeys } from './queryKeys';
import type { LeaveRequestInput } from '@/types/leave';

/**
 * POST a leave request, with the session's CSRF header when signed in (docs/auth-contract.md).
 * On success the balance and the list are invalidated (the new request uses up days); returning
 * that promise keeps `isPending` true until the balance on the form's page is fresh.
 */
export function useSubmitLeaveRequest() {
  const http = useApiClient();
  const queryClient = useQueryClient();
  const { csrfToken, csrfHeaderName } = useAuth();
  return useMutation({
    mutationFn: (input: LeaveRequestInput) =>
      submitLeaveRequest(
        requireApiClient(http),
        input,
        undefined,
        csrfToken ? { [csrfHeaderName]: csrfToken } : undefined,
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: leaveKeys.all }),
  });
}

export type SubmitLeaveRequestMutation = ReturnType<
  typeof useSubmitLeaveRequest
>;
