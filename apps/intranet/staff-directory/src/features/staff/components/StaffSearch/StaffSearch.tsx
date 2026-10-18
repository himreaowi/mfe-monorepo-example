import { useId } from 'react';
import { useSearchParams } from 'react-router';
import { RemoteFallback } from '@org/ui';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useDepartments } from '../../hooks/useDepartments';
import { useStaffSearch } from '../../hooks/useStaffSearch';
import { StaffCard } from '../StaffCard';
import styles from './StaffSearch.module.scss';

/**
 * Staff list with search and a department filter. The query lives in the URL (`?q=&department=`),
 * so results survive a reload and the back button; requests start 250 ms after typing stops.
 */
export function StaffSearch() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const department = params.get('department') ?? '';
  const debouncedQ = useDebouncedValue(q);
  const search = useStaffSearch({ q: debouncedQ, department });
  const departments = useDepartments();
  const searchId = useId();
  const departmentId = useId();

  const update = (key: 'q' | 'department', value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

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
            onChange={(event) => update('q', event.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor={departmentId}>Department</label>
          <select
            id={departmentId}
            value={department}
            onChange={(event) => update('department', event.target.value)}
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
