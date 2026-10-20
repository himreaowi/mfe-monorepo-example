import { useId } from 'react';
import { RemoteFallback } from '@org/ui';
import type { ApiResult } from '@org/use-api';
import type { StaffSearchQuery, StaffSearchResult } from '../../types/staff';
import { StaffCard } from '../StaffCard/StaffCard';
import styles from './StaffSearch.module.scss';

export type StaffSearchProps = {
  /** Search text and department (the page keeps them in the URL: `?q=&department=`). */
  query: StaffSearchQuery;
  /** The user changed the search text or the department. */
  onQueryChange: (key: keyof StaffSearchQuery, value: string) => void;
  /** From `useStaffSearch()`, called by the page. */
  search: ApiResult<StaffSearchResult>;
  /** From `useDepartments()`, called by the page. */
  departments: ApiResult<string[]>;
};

/**
 * Staff list with search and a department filter. Displays only: the page reads the query
 * from the URL, loads the results and the departments and passes them down
 * (docs/coding-conventions.md "Data fetching").
 */
export function StaffSearch({
  query: { q, department },
  onQueryChange,
  search,
  departments,
}: StaffSearchProps) {
  const searchId = useId();
  const departmentId = useId();

  const count =
    search.status === 'success'
      ? `${search.data.total} ${search.data.total === 1 ? 'person' : 'people'} found`
      : search.status === 'loading'
        ? 'Searching…'
        : '';

  return (
    <section className={styles.page} data-testid="staff-search">
      <h1 className={styles.title}>Staff directory</h1>
      <p className={styles.lead}>
        Find colleagues by name, job title, department or skill.
      </p>
      <form
        className={styles.filters}
        role="search"
        aria-label="Staff"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className={styles.field}>
          <label htmlFor={searchId}>Search staff</label>
          <input
            id={searchId}
            type="search"
            value={q}
            autoComplete="off"
            onChange={(event) => onQueryChange('q', event.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor={departmentId}>Department</label>
          <select
            id={departmentId}
            value={department}
            onChange={(event) =>
              onQueryChange('department', event.target.value)
            }
          >
            <option value="">All departments</option>
            {departments.status === 'success'
              ? departments.data.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))
              : null}
          </select>
        </div>
      </form>
      <p className={styles.status} role="status" data-testid="staff-count">
        {count}
      </p>
      {search.status === 'error' ? (
        <RemoteFallback
          title="Could not load the staff directory"
          reason={search.error.message}
          onRetry={search.reload}
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
            <StaffCard key={member.id} member={member} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
