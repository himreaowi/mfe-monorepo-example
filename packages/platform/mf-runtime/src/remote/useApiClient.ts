import type { HttpClient } from '@org/http-client';
import { useApiClientFor } from '../apiClient';
import { useHostProps } from './HostPropsContext';

/**
 * A remote's API client: base URL from host props `settings.apiBaseUrl` (the shell's
 * mfe-manifest.json; the standalone mock props in `src/app/apps.tsx`; in development the zone's
 * mock API), `credentials: 'include'` (backend session cookie, never tokens). `undefined` when
 * the environment has no `settings.apiBaseUrl`: show "not configured" instead of calling.
 */
export function useApiClient(): HttpClient | undefined {
  return useApiClientFor(useHostProps().settings);
}
