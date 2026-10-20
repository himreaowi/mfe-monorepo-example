import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { cx } from '../../utils/cx/cx';
import styles from './Tabs.module.scss';

export type TabItem = {
  /** Stable id (used for `selectedId` and the element ids). */
  id: string;
  label: ReactNode;
  content: ReactNode;
  disabled?: boolean;
};

export type TabsProps = {
  /** Accessible name of the tab list (`aria-label`), e.g. `Request details`. */
  label: string;
  tabs: TabItem[];
  /** Selected tab (controlled). */
  selectedId?: string;
  /** Initially selected tab (uncontrolled). Default: the first enabled tab. */
  defaultSelectedId?: string;
  onSelect?: (id: string) => void;
  /**
   * `automatic` (default): arrow keys move focus AND show the tab; good when panels render
   * instantly. `manual`: arrow keys only move focus, Enter/Space shows the tab; use it when
   * showing a panel is slow (it fetches data), so arrowing past tabs does not load each one.
   */
  activation?: 'automatic' | 'manual';
  className?: string;
};

/**
 * WAI-ARIA tabs pattern (https://www.w3.org/WAI/ARIA/apg/patterns/tabs/), built by hand:
 * `tablist` / `tab` / `tabpanel`, roving tabindex (Tab enters the list on the selected tab and
 * leaves to the panel), Left/Right arrows (wrapping), Home/End; disabled tabs are skipped.
 */
export function Tabs({
  label,
  tabs,
  selectedId: controlledId,
  defaultSelectedId,
  onSelect,
  activation = 'automatic',
  className,
}: TabsProps) {
  const baseId = useId();
  const firstEnabled = tabs.find((t) => !t.disabled)?.id;
  const [ownId, setOwnId] = useState(defaultSelectedId ?? firstEnabled);
  const selectedId = controlledId ?? ownId;
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  const select = (id: string) => {
    if (controlledId === undefined) setOwnId(id);
    onSelect?.(id);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const enabled = tabs.filter((t) => !t.disabled);
    const current = enabled.findIndex(
      (t) => tabRefs.current.get(t.id) === document.activeElement,
    );
    if (current === -1) return;
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
        next = (current + 1) % enabled.length;
        break;
      case 'ArrowLeft':
        next = (current - 1 + enabled.length) % enabled.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = enabled.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const target = enabled[next];
    tabRefs.current.get(target.id)?.focus();
    if (activation === 'automatic') select(target.id);
  };

  return (
    <div className={cx(styles.tabs, className)}>
      <div
        role="tablist"
        aria-label={label}
        className={styles.list}
        onKeyDown={onKeyDown}
      >
        {tabs.map((tab) => {
          const selected = tab.id === selectedId;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                if (node) tabRefs.current.set(tab.id, node);
                else tabRefs.current.delete(tab.id);
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              disabled={tab.disabled}
              className={styles.tab}
              onClick={() => select(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${baseId}-panel-${tab.id}`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          // the panel is the next Tab stop after the tab list
          tabIndex={0}
          hidden={tab.id !== selectedId}
          className={styles.panel}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
