/** Message of the error a loader rejects with when the environment configures no API. */
export const API_NOT_CONFIGURED =
  'No API is configured (settings.apiBaseUrl is missing).';

/**
 * The client from `useApiClient()` (`@org/mf-runtime/remote`), which is `undefined` when the
 * environment has no `settings.apiBaseUrl`. Call it inside an async loader or `send`: it then
 * rejects, so the hook shows its error state instead of sending a request nowhere.
 *
 *   const http = useApiClient();
 *   const load = useCallback(
 *     async (signal: AbortSignal) => getStaffMember(requireApiClient(http), id, signal),
 *     [http, id],
 *   );
 */
export function requireApiClient<T>(client: T | undefined): T {
  if (client === undefined) throw new Error(API_NOT_CONFIGURED);
  return client;
}
