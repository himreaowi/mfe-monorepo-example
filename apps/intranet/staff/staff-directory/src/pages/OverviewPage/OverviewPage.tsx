import {
  StaffFiltersProvider,
  StaffSearch,
  useDebouncedValue,
  useDepartments,
  useStaffFilters,
  useStaffSearch,
} from '@/features/staff';

/**
 * The staff directory. `<StaffFiltersProvider>` holds the search text and department (feature
 * state, stored in the URL as `?q=&department=`, so a link or a reload shows the same list):
 * `StaffFilters` (inside `StaffSearch`) changes them, `StaffDirectory` below searches with them.
 */
export function OverviewPage() {
  return (
    <div data-testid="overview-page">
      <StaffFiltersProvider>
        <StaffDirectory />
      </StaffFiltersProvider>
    </div>
  );
}

/**
 * Page-level data fetching, inside the provider: loads the results for the current filters
 * (250 ms after typing stops) and the departments, and passes them to `StaffSearch`, which only
 * displays (docs/coding-conventions.md "Data fetching").
 */
function StaffDirectory() {
  const { q, department } = useStaffFilters();
  const search = useStaffSearch({ q: useDebouncedValue(q), department });
  const departments = useDepartments();
  return (
    <StaffSearch
      search={search}
      departments={departments.status === 'success' ? departments.data : []}
    />
  );
}
