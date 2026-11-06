import { useQuery } from '@tanstack/react-query';
import { getDepartments, staffKeys } from '@org/intranet-directory';
import { requireApiClient } from '@org/http-client';
import { useApiClient } from '@org/mf-runtime/remote';

/** The department names for the filter, as a query result. */
export function useDepartments() {
  const http = useApiClient();
  return useQuery({
    queryKey: staffKeys.departments(),
    queryFn: ({ signal }) => getDepartments(requireApiClient(http), signal),
  });
}
