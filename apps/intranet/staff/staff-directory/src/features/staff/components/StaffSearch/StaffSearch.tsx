import {
  StaffCard,
  type StaffSearchResultQuery,
} from '@org/intranet-directory';
import { useRemotePath } from '@org/mf-runtime/remote';
import { RemoteFallback } from '@org/ui';
import { staffPath } from '@/core/constants/routePaths';
import { StaffFilters } from '../StaffFilters/StaffFilters';
import styles from './StaffSearch.module.scss';

export type StaffSearchProps = {
  /** From `useStaffSearch()`, called by the page with the current filters. */
  search: StaffSearchResultQuery;
  /** Department names for the filter (`useDepartments()`, called by the page). */
  departments: string[];
};

/**
 * Staff list with search and a department filter (`StaffFilters`, feature state in the URL).
 * Displays only: the page loads the results for the current filters and the departments and
 * passes them down (docs/coding-conventions.md "Data fetching"). Render it inside
 * `<StaffFiltersProvider>`.
 */
export function StaffSearch({ search, departments }: StaffSearchProps) {
  const toPath = useRemotePath();
  const count =
    search.status === 'success' && !search.isPlaceholderData
      ? `${search.data.total} ${search.data.total === 1 ? 'person' : 'people'} found`
      : search.status === 'pending' || search.isPlaceholderData
        ? 'Searching…'
        : '';

  return (
    <section className={styles.page} data-testid="staff-search">
      <h1 className={styles.title}>Staff directory</h1>
      <p className={styles.lead}>
        Find colleagues by name, job title, department or skill.
      </p>
      <StaffFilters departments={departments} />
      <p className={styles.status} role="status" data-testid="staff-count">
        {count}
      </p>
      {search.status === 'error' ? (
        <RemoteFallback
          title="Could not load the staff directory"
          reason={search.error.message}
          onRetry={() => void search.refetch()}
        />
      ) : null}
      {search.status === 'success' && search.data.items.length === 0 ? (
        <p className={styles.muted}>
          No one matches. Check the spelling or choose another department.
        </p>
      ) : null}
      {search.status === 'success' && search.data.items.length > 0 ? (
        <ul className={styles.results} aria-label="Staff">
          {search.data.items.map((member) => (
            <StaffCard
              key={member.id}
              member={member}
              to={toPath(staffPath(member.id))}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
