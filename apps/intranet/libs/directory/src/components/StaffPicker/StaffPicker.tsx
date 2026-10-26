import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Button, TextField, VisuallyHidden } from '@org/ui';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useStaffSearch } from '../../hooks/useStaffSearch';
import type { StaffSummary } from '../../types/staff';
import styles from './StaffPicker.module.scss';

const MAX_OPTIONS = 8;

export type StaffPickerProps = {
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
 * Search-as-you-type picker for one colleague (WAI-ARIA combobox with a listbox popup).
 * Type to search (250 ms after typing stops), ArrowUp/ArrowDown move through the results, Enter
 * chooses, Escape closes the list. The chosen person is shown with a Clear button. Needs the
 * API client (`useApiClient()`), so render it inside a remote (embedded or standalone).
 */
export function StaffPicker({
  label,
  value = null,
  onSelect,
  department = '',
  hint,
  error,
  required,
}: StaffPickerProps) {
  const listId = useId();
  const inputId = `${listId}-input`;
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const refocus = useRef(false);

  // after Clear the combobox replaces the read-only field: put the focus back on it
  useEffect(() => {
    if (value === null && refocus.current) {
      refocus.current = false;
      inputRef.current?.focus();
    }
  }, [value]);

  const query = useDebouncedValue(text.trim());
  const enabled = open && query !== '' && value === null;
  const search = useStaffSearch({ q: query, department }, { enabled });
  // `text` ahead of `query` (still typing): the list below belongs to the older text
  const settled = enabled && text.trim() === query;
  const items =
    settled && search.status === 'success'
      ? search.data.items.slice(0, MAX_OPTIONS)
      : [];
  const expanded = open && items.length > 0;
  const active = Math.min(activeIndex, items.length - 1);
  const optionId = (index: number) => `${listId}-option-${index}`;

  const status =
    text.trim() === '' || !open
      ? ''
      : !settled || search.status === 'loading'
        ? 'Searching…'
        : search.status === 'error'
          ? 'Could not search the staff directory. Try again.'
          : items.length === 0
            ? 'No one matches.'
            : `${items.length} ${items.length === 1 ? 'person' : 'people'} found. Use the up and down arrow keys, then Enter to choose.`;

  function choose(person: StaffSummary) {
    setText('');
    setOpen(false);
    setActiveIndex(-1);
    onSelect(person);
  }

  function clear() {
    refocus.current = true;
    onSelect(null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        if (items.length === 0) return;
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setActiveIndex((active + step + items.length) % items.length);
        return;
      }
      case 'Enter':
        if (expanded) {
          event.preventDefault(); // choosing must not submit the form
          if (active >= 0) choose(items[active]);
        }
        return;
      case 'Escape':
        if (open) {
          event.preventDefault();
          event.stopPropagation(); // do not close a dialog around the picker too
          setOpen(false);
          setActiveIndex(-1);
        }
        return;
      default:
    }
  }

  if (value) {
    return (
      <div className={styles.picker} data-testid="staff-picker">
        <TextField
          id={inputId}
          label={label}
          hint={hint}
          error={error}
          required={required}
          value={value.name}
          readOnly
        />
        <div className={styles.selected}>
          <p className={styles.person}>
            {value.jobTitle}, {value.department}
          </p>
          <Button variant="secondary" size="sm" onClick={clear}>
            Clear<VisuallyHidden> {label}</VisuallyHidden>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.picker} data-testid="staff-picker">
      <TextField
        id={inputId}
        label={label}
        hint={hint}
        error={error}
        required={required}
        ref={inputRef}
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={`${listId}-listbox`}
        aria-activedescendant={
          expanded && active >= 0 ? optionId(active) : undefined
        }
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          setOpen(false);
          setActiveIndex(-1);
          setText('');
        }}
      />
      <p className={styles.status} role="status">
        {status}
      </p>
      <ul
        id={`${listId}-listbox`}
        role="listbox"
        aria-label={`${label} results`}
        className={styles.listbox}
        hidden={!expanded}
      >
        {items.map((person, index) => (
          <li
            key={person.id}
            id={optionId(index)}
            role="option"
            aria-selected={index === active}
            className={styles.option}
            // keep the focus in the input while clicking, so the list stays open until chosen
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(person)}
          >
            <span className={styles.name}>{person.name}</span>
            <span className={styles.person}>
              {person.jobTitle}, {person.department}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
