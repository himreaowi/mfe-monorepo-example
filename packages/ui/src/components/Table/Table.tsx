import {
  useId,
  useMemo,
  useState,
  type ComponentPropsWithRef,
  type ReactNode,
} from 'react';
import { cx } from '../../utils/cx/cx';
import { VisuallyHidden } from '../VisuallyHidden/VisuallyHidden';
import styles from './Table.module.scss';

export type SortDirection = 'ascending' | 'descending';
export type TableSort = { key: string; direction: SortDirection };

export type TableColumn<Row> = {
  /** Column id; also the row property shown when there is no `cell`. */
  key: string;
  header: ReactNode;
  /** Cell content. Default: `row[key]` as text. */
  cell?: (row: Row) => ReactNode;
  /** Header becomes a sort button (`aria-sort` on the `<th>`). */
  sortable?: boolean;
  /** Value to sort by. Default: `row[key]`. */
  sortValue?: (row: Row) => string | number | Date | null | undefined;
  /** `end` for numbers. Default `start`. */
  align?: 'start' | 'end';
  /** Cells of this column are row headers (`<th scope="row">`), e.g. a name column. */
  rowHeader?: boolean;
};

export type TableProps<Row> = Omit<
  ComponentPropsWithRef<'table'>,
  'children'
> & {
  /** Names the table (`<caption>`) and its scroll region. Required. */
  caption: ReactNode;
  /** Keep the caption for screen readers only (a visible heading already says it). */
  captionHidden?: boolean;
  columns: TableColumn<Row>[];
  rows: Row[];
  /** Stable key of a row (its id). */
  getRowKey: (row: Row, index: number) => string | number;
  /** Sort state (controlled). `null`: unsorted. */
  sort?: TableSort | null;
  /** Initial sort state (uncontrolled). */
  defaultSort?: TableSort | null;
  /** A sort header was activated. With `sort` set you store the new state yourself. */
  onSortChange?: (sort: TableSort) => void;
  /** Shown in one full-width row when `rows` is empty. Default `No data.` */
  emptyMessage?: ReactNode;
};

/**
 * Semantic data table: `<caption>`, `<th scope="col">`, optional row headers. Sortable columns
 * get a button in their header and `aria-sort`; rows are sorted here (by `sortValue` or the
 * row property). The table scrolls sideways inside a focusable region on narrow screens.
 */
export function Table<Row>({
  caption,
  captionHidden = false,
  columns,
  rows,
  getRowKey,
  sort: controlledSort,
  defaultSort = null,
  onSortChange,
  emptyMessage = 'No data.',
  className,
  ...rest
}: TableProps<Row>) {
  const captionId = useId();
  const [ownSort, setOwnSort] = useState<TableSort | null>(defaultSort);
  const sort = controlledSort !== undefined ? controlledSort : ownSort;

  const sortedRows = useMemo(() => {
    const column = sort ? columns.find((c) => c.key === sort.key) : undefined;
    if (!sort || !column) return rows;
    const valueOf =
      column.sortValue ?? ((row: Row) => cellValue(row, column.key));
    const factor = sort.direction === 'ascending' ? 1 : -1;
    return [...rows].sort((a, b) => factor * compare(valueOf(a), valueOf(b)));
  }, [rows, columns, sort]);

  const toggleSort = (key: string) => {
    const next: TableSort = {
      key,
      direction:
        sort?.key === key && sort.direction === 'ascending'
          ? 'descending'
          : 'ascending',
    };
    if (controlledSort === undefined) setOwnSort(next);
    onSortChange?.(next);
  };

  const sortedColumn = sort
    ? columns.find((c) => c.key === sort.key)
    : undefined;

  return (
    <div
      className={styles.scroll}
      role="region"
      aria-labelledby={captionId}
      // keyboard users can scroll a table wider than the screen
      tabIndex={0}
    >
      <table {...rest} className={cx(styles.table, className)}>
        <caption
          id={captionId}
          className={captionHidden ? styles.hidden : styles.caption}
        >
          {caption}
        </caption>
        <thead>
          <tr>
            {columns.map((column) => {
              const ariaSort = column.sortable
                ? sort?.key === column.key
                  ? sort.direction
                  : 'none'
                : undefined;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={ariaSort}
                  className={cx(column.align === 'end' && styles.end)}
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      className={styles.sortButton}
                      onClick={() => toggleSort(column.key)}
                    >
                      {column.header}
                      <span className={styles.sortIcon} aria-hidden="true">
                        {ariaSort === 'ascending'
                          ? '▲'
                          : ariaSort === 'descending'
                            ? '▼'
                            : '↕'}
                      </span>
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={styles.empty}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sortedRows.map((row, index) => (
              <tr key={getRowKey(row, index)}>
                {columns.map((column) => {
                  const content = column.cell
                    ? column.cell(row)
                    : String(cellValue(row, column.key) ?? '');
                  const cellClass = cx(column.align === 'end' && styles.end);
                  return column.rowHeader ? (
                    <th key={column.key} scope="row" className={cellClass}>
                      {content}
                    </th>
                  ) : (
                    <td key={column.key} className={cellClass || undefined}>
                      {content}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
      <VisuallyHidden role="status">
        {sortedColumn && sort && typeof sortedColumn.header === 'string'
          ? `Sorted by ${sortedColumn.header}, ${sort.direction}`
          : ''}
      </VisuallyHidden>
    </div>
  );
}

function cellValue(row: unknown, key: string): unknown {
  return typeof row === 'object' && row !== null
    ? (row as Record<string, unknown>)[key]
    : undefined;
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined || a === '') return 1;
  if (b === null || b === undefined || b === '') return -1;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}
