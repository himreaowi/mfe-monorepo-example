import { useId } from 'react';
import {
  useStaffFilters,
  useStaffFiltersDispatch,
} from '../../state/StaffFiltersContext';
import styles from './StaffFilters.module.scss';

/**
 * Search text and department filter. Reads and changes the feature's filter state
 * (StaffFiltersContext, kept in the URL); the department names come from the page (API data,
 * props).
 */
export function StaffFilters({ departments }: { departments: string[] }) {
  const { q, department } = useStaffFilters();
  const dispatch = useStaffFiltersDispatch();
  const searchId = useId();
  const departmentId = useId();

  return (
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
          onChange={(event) =>
            dispatch({ type: 'queryChanged', q: event.target.value })
          }
        />
      </div>
      <div className={styles.field}>
        <label htmlFor={departmentId}>Department</label>
        <select
          id={departmentId}
          value={department}
          onChange={(event) =>
            dispatch({
              type: 'departmentChanged',
              department: event.target.value,
            })
          }
        >
          <option value="">All departments</option>
          {departments.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
    </form>
  );
}
