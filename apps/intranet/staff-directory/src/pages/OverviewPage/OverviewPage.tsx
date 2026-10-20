import { useSearchParams } from 'react-router';
import {
  StaffSearch,
  useDebouncedValue,
  useDepartments,
  useStaffSearch,
  type StaffSearchQuery,
} from '@/features/staff';

/**
 * Page-level data fetching: the page reads the query from the URL (`?q=&department=`, so
 * results survive a reload and the back button), loads the results (250 ms after typing stops)
 * and the departments, and passes them to `StaffSearch`, which only displays.
 */
export function OverviewPage() {
  const [params, setParams] = useSearchParams();
  const query: StaffSearchQuery = {
    q: params.get('q') ?? '',
    department: params.get('department') ?? '',
  };
  const search = useStaffSearch({
    q: useDebouncedValue(query.q),
    department: query.department,
  });
  const departments = useDepartments();

  const onQueryChange = (key: keyof StaffSearchQuery, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <div data-testid="overview-page">
      <StaffSearch
        query={query}
        onQueryChange={onQueryChange}
        search={search}
        departments={departments}
      />
    </div>
  );
}
