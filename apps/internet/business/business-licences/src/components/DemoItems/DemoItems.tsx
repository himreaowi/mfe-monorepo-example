import { API_NOT_CONFIGURED } from '@org/http-client';
import { Alert, Button, Spinner, Table, type TableColumn } from '@org/ui';
import type { CreateItemMutation } from '@/hooks/useCreateItem';
import type { ItemsQuery } from '@/hooks/useItems';
import type { Item } from '@/types/item';
import { describeError } from '@/utils/itemErrors';
import { AddItemForm } from '@/components/AddItemForm/AddItemForm';
import styles from './DemoItems.module.scss';

const columns: TableColumn<Item>[] = [
  { key: 'name', header: 'Name', rowHeader: true, sortable: true },
  { key: 'description', header: 'Description' },
];
/** The UEN column appears once an item has one (the seed items have none). */
const columnsWithUen: TableColumn<Item>[] = [
  ...columns,
  { key: 'uen', header: 'UEN' },
];

export type DemoItemsProps = {
  /** From `useItems()`, called by the page. */
  items: ItemsQuery;
  /** From `useCreateItem()`, called by the page. */
  createItem: CreateItemMutation;
};

/**
 * Displays the items and the "Add item" form. It fetches nothing: the page calls the feature's
 * data hooks (`useItems`, `useCreateItem`) and passes their results down, so every API call of a
 * page is visible in one place (docs/coding-conventions.md "Data fetching"). The chain:
 * apiRoutes → useApiClient() → api/ → hooks/ (TanStack Query) → page → this component.
 * In development the data comes from the zone's mock API (tools/mock-api).
 */
export function DemoItems({ items, createItem }: DemoItemsProps) {
  return (
    <section
      className={styles.items}
      aria-labelledby="demo-items-title"
      data-testid="demo-items"
    >
      <h2 id="demo-items-title" className={styles.subtitle}>
        Items from the API
      </h2>
      {items.status === 'pending' ? (
        <Spinner label="Loading items…" labelVisible />
      ) : null}
      {items.status === 'error' &&
      items.error.message === API_NOT_CONFIGURED ? (
        <p className={styles.copy}>
          No API configured: set <code>settings.apiBaseUrl</code> in the
          manifest.
        </p>
      ) : null}
      {items.status === 'error' &&
      items.error.message !== API_NOT_CONFIGURED ? (
        <Alert variant="error">
          <p>{describeError(items.error, 'Could not load the items')}</p>
          <Button
            variant="secondary"
            loading={items.isFetching}
            onClick={() => void items.refetch()}
          >
            Try again
          </Button>
        </Alert>
      ) : null}
      {items.status === 'success' ? (
        <>
          {items.data.length === 0 ? (
            <p className={styles.copy}>No items yet.</p>
          ) : (
            <Table
              caption="Items"
              captionHidden
              columns={
                items.data.some((item) => item.uen) ? columnsWithUen : columns
              }
              rows={items.data}
              getRowKey={(item) => item.id}
              data-testid="demo-item-list"
            />
          )}
          <AddItemForm createItem={createItem} />
        </>
      ) : null}
    </section>
  );
}
