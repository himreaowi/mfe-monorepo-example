import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@org/auth';
import { requireApiClient } from '@org/http-client';
import { useApiClient } from '@org/mf-runtime/remote';
import { getProfile, updatePreferences } from '@/api/profileApi';
import { profileKeys } from './queryKeys';
import type { Preferences } from '@/types/profile';

/**
 * The signed-in user's profile as a query result. A 401 re-checks the session by itself:
 * `useApiClient()` calls the host's `onUnauthorized` (the shell's `useAuth().refresh`), the
 * guard then shows sign-in.
 */
export function useProfile() {
  const http = useApiClient();
  return useQuery({
    queryKey: profileKeys.me(),
    queryFn: ({ signal }) => getProfile(requireApiClient(http), signal),
  });
}

export type ProfileQuery = ReturnType<typeof useProfile>;

/**
 * PUT the preferences with the session's CSRF header (docs/auth-contract.md). On success the
 * profile is invalidated and loaded again.
 */
export function useSavePreferences() {
  const http = useApiClient();
  const queryClient = useQueryClient();
  const { csrfToken, csrfHeaderName } = useAuth();
  return useMutation({
    mutationFn: (preferences: Preferences) =>
      updatePreferences(
        requireApiClient(http),
        preferences,
        csrfToken ? { [csrfHeaderName]: csrfToken } : {},
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: profileKeys.all }),
  });
}

export type SavePreferencesMutation = ReturnType<typeof useSavePreferences>;
