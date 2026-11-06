import type { HttpClient } from '@org/http-client';
import { useApiClientFor } from './apiClient';
import { useMfeManifest } from './ManifestContext';

/**
 * A shell's API client: base URL from the loaded manifest's `settings.apiBaseUrl`
 * (`MfeManifestProvider`), `credentials: 'include'`. `undefined` outside the provider or when the
 * manifest has no `settings.apiBaseUrl`. Remotes use `useApiClient()` from
 * `@org/mf-runtime/remote` (host props) instead.
 */
export function useApiClient(): HttpClient | undefined {
  return useApiClientFor(useMfeManifest()?.settings);
}
