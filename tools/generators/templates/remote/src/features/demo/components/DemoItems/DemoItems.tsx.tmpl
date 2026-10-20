import { Button } from '@org/ui';
import type { CreateItemResult } from '../../hooks/useCreateItem';
import type { ItemsState } from '../../hooks/useItems';
import type { Item, ItemDraft } from '../../types/item';
import { AddItemForm } from '../AddItemForm/AddItemForm';
import styles from './DemoItems.module.scss';

export type DemoItemsProps = {
  /** From `useItems()`, called by the page. */
  state: ItemsState;
  /** Load again after an error (`useItems().reload`). */
  onRetry: () => void;
  /** Send a new item (`useCreateItem()`, called by the page). */
  onCreate: (draft: ItemDraft) => Promise<CreateItemResult>;
  /** A new item was created: show it (`useItems().add`). */
  onCreated: (item: Item) => void;
};

/**
 * Displays the items and the "Add item" form. It fetches nothing: the page calls the feature's
 * data hooks (`useItems`, `useCreateItem`) and passes data and callbacks down, so every API call
 * of a page is visible in one place (docs/coding-conventions.md "Data fetching"). The chain:
 * apiRoutes → useApiClient() → api/ → hooks/ → page → this component.
 * In development the data comes from the zone's mock API (tools/mock-api).
 */
export function DemoItems({
  state,
  onRetry,
  onCreate,
  onCreated,
}: DemoItemsProps) {
  return (
    <section
      className={styles.items}
      aria-labelledby="demo-items-title"
      data-testid="demo-items"
    >
      <h2 id="demo-items-title" className={styles.subtitle}>
        Items from the API
      </h2>
      {state.status === 'unconfigured' ? (
        <p className={styles.copy}>
          No API configured: set <code>settings.apiBaseUrl</code> in the
          manifest.
        </p>
      ) : null}
      {state.status === 'loading' ? (
        <p className={styles.copy} role="status">
          Loading items…
        </p>
      ) : null}
      {state.status === 'error' ? (
        <div className={styles.error} role="alert">
          <p>{state.message}</p>
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : null}
      {state.status === 'success' ? (
        <>
          {state.items.length === 0 ? (
            <p className={styles.copy}>No items yet.</p>
          ) : (
            <ul className={styles.list} data-testid="demo-item-list">
              {state.items.map((item) => (
                <li key={item.id}>
                  <strong>{item.name}</strong>
                  {item.description ? (
                    <span className={styles.copy}> — {item.description}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <AddItemForm onCreate={onCreate} onCreated={onCreated} />
        </>
      ) : null}
    </section>
  );
}
