import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Field, type FieldLabelProps } from '../Field/Field';
import { VisuallyHidden } from '../VisuallyHidden/VisuallyHidden';
import { CloseIcon } from '../../icons/CloseIcon';
import styles from './Combobox.module.scss';

export type ComboboxProps<Item> = FieldLabelProps & {
  /** The input's id. Default: generated. */
  id?: string;
  /** Class of the wrapper (width, margins). */
  className?: string;
  /** The options to show for the current text: the caller searches (e.g. a query hook). */
  items: readonly Item[];
  /** The chosen item (controlled). `null`: nothing chosen. */
  value: Item | null;
  /** Called with the item the user chose, or `null` when they cleared the choice. */
  onValueChange: (value: Item | null) => void;
  /** Called with the text the user types; `''` when the input is reset (item chosen, cleared). */
  onInputValueChange?: (text: string) => void;
  /** The item's text: shown in the input once chosen, and in the list (unless `renderItem`). */
  itemToString: (item: Item) => string;
  /** Stable key of an item (also compares the chosen item with new results). Default: `itemToString`. */
  itemToKey?: (item: Item) => string;
  /** Content of an option. Default: `itemToString(item)`. */
  renderItem?: (item: Item) => ReactNode;
  /** The caller is searching: shows (and announces) `loadingText` instead of the list. */
  loading?: boolean;
  /** Default `Searching…`. */
  loadingText?: string;
  /** Shown when the typed text has no results. Default `No results.` */
  emptyText?: string;
  /** Announced to screen readers when results arrive. Default `3 results` / `1 result`. */
  resultsText?: (count: number) => string;
  /** Accessible name of the × button that clears the choice. Default `Clear`. */
  clearLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Form field name (the hidden input holds `itemToKey` of the chosen item). */
  name?: string;
};

const defaultResultsText = (count: number) =>
  `${count} ${count === 1 ? 'result' : 'results'}`;

/**
 * Search-as-you-type picker of one item: the WAI-ARIA APG "combobox with listbox popup"
 * (an input with `role="combobox"`, `aria-activedescendant` pointing into a listbox). The
 * caller does the search: it gets the typed text from `onInputValueChange` and passes the
 * results in `items` (no filtering here), with `loading` while they load. ArrowDown/ArrowUp
 * move through the options, Enter chooses, Escape closes the list; the × button clears the
 * choice. Loading, result count and "no results" are announced (live region). Label, hint and
 * error as in Field.
 *
 * Non-modal on purpose: while the list is open the rest of the page stays as it is (nothing is
 * aria-hidden or trapped), as the APG pattern requires. Base UI Combobox aria-hides the page
 * whenever the input sits outside its popup, so this component does not use it.
 */
export function Combobox<Item>({
  label,
  hint,
  error,
  required,
  id,
  className,
  items,
  value,
  onValueChange,
  onInputValueChange,
  itemToString,
  itemToKey = itemToString,
  renderItem = itemToString,
  loading = false,
  loadingText = 'Searching…',
  emptyText = 'No results.',
  resultsText = defaultResultsText,
  clearLabel = 'Clear',
  placeholder,
  disabled,
  name,
}: ComboboxProps<Item>) {
  const listId = `${useId()}-listbox`;
  const inputRef = useRef<HTMLInputElement>(null);
  // `null`: not editing, the input shows the chosen item's text
  const [text, setText] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const shown = loading ? [] : items;
  const searching = open && text !== null && text.trim() !== '';
  const expanded = searching && shown.length > 0;
  const active = activeIndex < shown.length ? activeIndex : -1;
  const optionId = (index: number) => `${listId}-option-${index}`;
  const chosenKey = value === null ? null : itemToKey(value);
  const inputText = text ?? (value === null ? '' : itemToString(value));

  const message = !searching
    ? null
    : loading
      ? loadingText
      : shown.length === 0
        ? emptyText
        : null;

  /** Stop editing: the input shows the chosen item again, the caller's search is reset. */
  function reset() {
    setOpen(false);
    setActiveIndex(-1);
    if (text !== null) {
      setText(null);
      if (text !== '') onInputValueChange?.('');
    }
  }

  function choose(item: Item) {
    reset();
    onValueChange(item);
  }

  function clear() {
    reset();
    onValueChange(null);
    inputRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        setOpen(true);
        if (shown.length === 0) return;
        const step = event.key === 'ArrowDown' ? 1 : -1;
        const from = active === -1 && step === -1 ? 0 : active;
        setActiveIndex((from + step + shown.length) % shown.length);
        return;
      }
      case 'Enter':
        if (expanded && active >= 0) {
          event.preventDefault(); // choosing must not submit the form
          choose(shown[active]);
        }
        return;
      case 'Escape':
        if (expanded || message !== null) {
          event.preventDefault();
          event.stopPropagation(); // do not close a dialog around the combobox too
          setOpen(false);
          setActiveIndex(-1);
        }
        return;
      default:
    }
  }

  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      id={id}
      className={className}
    >
      {(control) => (
        <div className={styles.group}>
          <input
            {...control}
            ref={inputRef}
            type="text"
            role="combobox"
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={expanded}
            aria-controls={listId}
            aria-activedescendant={
              expanded && active >= 0 ? optionId(active) : undefined
            }
            placeholder={placeholder}
            disabled={disabled}
            className={styles.input}
            value={inputText}
            onChange={(event) => {
              setText(event.target.value);
              setOpen(true);
              setActiveIndex(-1);
              onInputValueChange?.(event.target.value);
            }}
            onKeyDown={handleKeyDown}
            onBlur={reset}
          />
          {name ? (
            <input type="hidden" name={name} value={chosenKey ?? ''} />
          ) : null}
          {!disabled && (value !== null || inputText !== '') ? (
            <button
              type="button"
              className={styles.clear}
              aria-label={clearLabel}
              // keep the focus in the input while clicking
              onMouseDown={(event) => event.preventDefault()}
              onClick={clear}
            >
              <CloseIcon size="sm" />
            </button>
          ) : null}
          <div
            className={styles.popup}
            data-open={expanded || message !== null || undefined}
            aria-busy={(searching && loading) || undefined}
          >
            {/* always mounted, so the changes are announced */}
            <div role="status">
              {message !== null ? (
                <div className={styles.message}>{message}</div>
              ) : expanded ? (
                <VisuallyHidden>{resultsText(shown.length)}</VisuallyHidden>
              ) : null}
            </div>
            <ul
              id={listId}
              role="listbox"
              aria-labelledby={`${control.id}-label`}
              className={styles.list}
              hidden={!expanded}
            >
              {expanded
                ? shown.map((item, index) => {
                    const key = itemToKey(item);
                    return (
                      <li
                        key={key}
                        id={optionId(index)}
                        role="option"
                        aria-selected={index === active}
                        data-highlighted={index === active || undefined}
                        data-selected={key === chosenKey || undefined}
                        className={styles.item}
                        // keep the focus in the input while clicking
                        onMouseDown={(event) => event.preventDefault()}
                        onMouseMove={() => setActiveIndex(index)}
                        onClick={() => choose(item)}
                      >
                        {renderItem(item)}
                      </li>
                    );
                  })
                : null}
            </ul>
          </div>
        </div>
      )}
    </Field>
  );
}
