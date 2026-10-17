import { useCallback } from 'react';
import { useAuth } from '@org/auth';
import { HttpClientError } from '@org/http-client';
import { useApi, useSubmit } from '@org/use-api';
import { useApiClient } from '@/services/http';
import { getProfile, updatePreferences } from '../api';
import type { Preferences } from '../types/profile';

/** A 401 means the session ended: let the shell re-check it (the guard then shows sign-in). */
function useOnUnauthorized() {
  const { refresh } = useAuth();
  return useCallback(
    (error: unknown) => {
      if (error instanceof HttpClientError && error.status === 401) {
        void refresh();
      }
    },
    [refresh],
  );
}

export function useProfile() {
  const http = useApiClient();
  const onUnauthorized = useOnUnauthorized();
  const load = useCallback(
    async (signal: AbortSignal) => {
      try {
        return await getProfile(http, signal);
      } catch (error) {
        onUnauthorized(error);
        throw error;
      }
    },
    [http, onUnauthorized],
  );
  return useApi(load);
}

/** PUT the preferences with the session's CSRF header (docs/auth-contract.md). */
export function useSavePreferences() {
  const http = useApiClient();
  const { csrfToken, csrfHeaderName } = useAuth();
  const onUnauthorized = useOnUnauthorized();
  return useSubmit(async (preferences: Preferences, signal: AbortSignal) => {
    try {
      return await updatePreferences(
        http,
        preferences,
        csrfToken ? { [csrfHeaderName]: csrfToken } : {},
        signal,
      );
    } catch (error) {
      onUnauthorized(error);
      throw error;
    }
  });
}
