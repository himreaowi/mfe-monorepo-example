import { useQuery } from '@tanstack/react-query';
import { requireApiClient } from '@org/http-client';
import { useApiClient } from '@org/mf-runtime/remote';
import { listItems } from '../api/itemsApi';
import { demoKeys } from '../queryKeys';

/**
 * The item list as a query result, which the page passes down: `status` is `pending`, `error` or
 * `success`, `refetch()` tries again. A leaving page aborts the request (`signal`). Without
 * `settings.apiBaseUrl` the query fails with `API_NOT_CONFIGURED`, nothing is sent.
 */
export function useItems() {
  const http = useApiClient();
  return useQuery({
    queryKey: demoKeys.items(),
    queryFn: ({ signal }) => listItems(requireApiClient(http), signal),
  });
}

export type ItemsQuery = ReturnType<typeof useItems>;
