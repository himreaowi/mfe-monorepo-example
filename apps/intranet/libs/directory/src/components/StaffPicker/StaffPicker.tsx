import { useState } from 'react';
import { Combobox } from '@org/ui';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useStaffSearch } from '../../hooks/useStaffSearch';
import type { StaffSummary } from '../../types/staff';
import styles from './StaffPicker.module.scss';

const MAX_OPTIONS = 8;

export type StaffPickerProps = {
  /** Id of the search input (to link to it, e.g. from an error summary). Default: generated. */
  id?: string;
  /** Visible label of the field. */
  label: string;
  /** The chosen person (controlled). `null`/`undefined`: nobody chosen. */
  value?: StaffSummary | null;
  /** Called with the person the user chose, or `null` when they cleared the choice. */
  onSelect(person: StaffSummary | null): void;
  /** Only search this department. */
  department?: string;
  hint?: string;
  error?: string;
  required?: boolean;
};

/**
 * Search-as-you-type picker for one colleague, on the @org/ui Combobox. Type to search (250 ms
 * after typing stops); the Combobox does the keyboard, the list and the announcements. The
 * chosen person is shown in the field with their job title and department below; the × button
 * clears the choice. Needs the API client (`useApiClient()`), so render it inside a remote
 * (embedded or standalone).
 */
export function StaffPicker({
  id,
  label,
  value = null,
  onSelect,
  department = '',
  hint,
  error,
  required,
}: StaffPickerProps) {
  const [text, setText] = useState('');
  const query = useDebouncedValue(text.trim());
  const enabled = query !== '' && value === null;
  const search = useStaffSearch({ q: query, department }, { enabled });
  // `text` ahead of `query` (still typing), or the list on screen is the previous search kept
  // while this one loads: either way the list belongs to older text
  const settled = enabled && text.trim() === query && !search.isPlaceholderData;
  const loading =
    text.trim() !== '' && (!settled || search.status === 'pending');
  const items =
    settled && search.status === 'success'
      ? search.data.items.slice(0, MAX_OPTIONS)
      : [];

  return (
    <div className={styles.picker} data-testid="staff-picker">
      <Combobox<StaffSummary>
        id={id}
        label={label}
        hint={hint}
        error={
          error ??
          (settled && search.status === 'error'
            ? 'Could not search the staff directory. Try again.'
            : undefined)
        }
        required={required}
        items={items}
        value={value}
        onValueChange={onSelect}
        onInputValueChange={setText}
        itemToString={(person) => person.name}
        itemToKey={(person) => person.id}
        renderItem={(person) => (
          <>
            <span className={styles.name}>{person.name}</span>
            <span className={styles.detail}>
              {person.jobTitle}, {person.department}
            </span>
          </>
        )}
        loading={loading}
        emptyText="No one matches."
        resultsText={(count) =>
          `${count} ${count === 1 ? 'person' : 'people'} found`
        }
        clearLabel={`Clear ${label}`}
      />
      {value ? (
        <p className={styles.person}>
          {value.jobTitle}, {value.department}
        </p>
      ) : null}
    </div>
  );
}
