import { useState, type ReactNode } from 'react';
import { Combobox as BaseCombobox } from '@base-ui/react/combobox';
import { CSPProvider } from '@base-ui/react/csp-provider';
import { Field, type FieldLabelProps } from '../Field/Field';
import { VisuallyHidden } from '../VisuallyHidden/VisuallyHidden';
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
 * Search-as-you-type picker of one item: WAI-ARIA combobox (an input with a listbox popup) on
 * Base UI Combobox. The caller does the search: it gets the typed text from
 * `onInputValueChange` and passes the results in `items` (no filtering here), with `loading`
 * while they load. ArrowDown/ArrowUp move through the options, Enter chooses, Escape closes the
 * list; the × button clears the choice. Loading, result count and "no results" are announced
 * (live regions). Label, hint and error as in Field. No `<style>` elements (CSPProvider), so it
 * works under the strict CSP.
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
  const [query, setQuery] = useState('');
  const searching = query.trim() !== '';
  const shown = loading ? [] : items;

  return (
    <CSPProvider disableStyleElements>
      <BaseCombobox.Root<Item>
        items={shown as Item[]}
        value={value}
        onValueChange={(next) => onValueChange(next ?? null)}
        onInputValueChange={(text, { reason }) => {
          // only typing is a search; choosing or clearing puts the item's text in the input
          const typed = reason === 'input-change' ? text : '';
          setQuery(typed);
          onInputValueChange?.(typed);
        }}
        itemToStringLabel={itemToString}
        itemToStringValue={itemToKey}
        isItemEqualToValue={(a, b) => itemToKey(a) === itemToKey(b)}
        filter={null}
        disabled={disabled}
        required={required}
        name={name}
      >
        <Field
          label={label}
          hint={hint}
          error={error}
          required={required}
          id={id}
          className={className}
        >
          {(control) => (
            <BaseCombobox.InputGroup className={styles.group}>
              <BaseCombobox.Input
                {...control}
                placeholder={placeholder}
                className={styles.input}
              />
              <BaseCombobox.Clear
                className={styles.clear}
                aria-label={clearLabel}
              >
                <span aria-hidden="true">×</span>
              </BaseCombobox.Clear>
            </BaseCombobox.InputGroup>
          )}
        </Field>
        <BaseCombobox.Portal>
          <BaseCombobox.Positioner className={styles.positioner} sideOffset={4}>
            <BaseCombobox.Popup
              className={styles.popup}
              aria-busy={loading || undefined}
            >
              <BaseCombobox.Status>
                {loading && searching ? (
                  <div className={styles.message}>{loadingText}</div>
                ) : searching && shown.length > 0 ? (
                  <VisuallyHidden>{resultsText(shown.length)}</VisuallyHidden>
                ) : null}
              </BaseCombobox.Status>
              <BaseCombobox.Empty>
                {searching && !loading ? (
                  <div className={styles.message}>{emptyText}</div>
                ) : null}
              </BaseCombobox.Empty>
              <BaseCombobox.List className={styles.list}>
                {(item: Item) => (
                  <BaseCombobox.Item
                    key={itemToKey(item)}
                    value={item}
                    className={styles.item}
                  >
                    {renderItem(item)}
                  </BaseCombobox.Item>
                )}
              </BaseCombobox.List>
            </BaseCombobox.Popup>
          </BaseCombobox.Positioner>
        </BaseCombobox.Portal>
      </BaseCombobox.Root>
    </CSPProvider>
  );
}
