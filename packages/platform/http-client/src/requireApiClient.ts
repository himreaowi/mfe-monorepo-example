/** Message of the error a query or mutation rejects with when the environment configures no API. */
export const API_NOT_CONFIGURED =
  'No API is configured (settings.apiBaseUrl is missing).';

/**
 * The client from `useApiClient()`, which is `undefined` when the environment has no
 * `settings.apiBaseUrl`. Call it inside a `queryFn` or `mutationFn`: it then rejects, so the hook
 * shows its error state instead of sending a request nowhere. It is not retried.
 *
 *   const http = useApiClient();
 *   return useQuery({
 *     queryKey: staffKeys.detail(id),
 *     queryFn: ({ signal }) => getStaffMember(requireApiClient(http), id, signal),
 *   });
 */
export function requireApiClient<T>(client: T | undefined): T {
  if (client === undefined) throw new Error(API_NOT_CONFIGURED);
  return client;
}
