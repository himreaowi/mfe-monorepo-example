import { useId } from 'react';
import { Select, TextField } from '@org/ui';
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
      <TextField
        id={searchId}
        className={styles.field}
        label="Search staff"
        type="search"
        value={q}
        autoComplete="off"
        onChange={(event) =>
          dispatch({ type: 'queryChanged', q: event.target.value })
        }
      />
      <Select
        id={departmentId}
        className={styles.field}
        label="Department"
        value={department}
        onChange={(event) =>
          dispatch({
            type: 'departmentChanged',
            department: event.target.value,
          })
        }
        placeholder="All departments"
        options={departments.map((name) => ({ value: name, label: name }))}
      />
    </form>
  );
}
