import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { CSPProvider } from '@base-ui/react/csp-provider';
import { Tabs as BaseTabs } from '@base-ui/react/tabs';
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
 * WAI-ARIA tabs pattern (https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) on Base UI Tabs:
 * `tablist` / `tab` / `tabpanel`, roving tabindex (Tab enters the list on the selected tab and
 * leaves to the panel), Left/Right arrows (wrapping), Home/End; disabled tabs are skipped
 * (Base UI would focus them; `skipDisabled` keeps the arrow keys on enabled tabs).
 * Every panel stays mounted (hidden) like before. No `<style>` elements (CSPProvider), so it
 * works under the strict CSP.
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
  const firstEnabled = tabs.find((t) => !t.disabled)?.id;
  const [ownId, setOwnId] = useState(defaultSelectedId ?? firstEnabled);
  const selectedId = controlledId ?? ownId ?? null;

  const select = (id: string) => {
    if (controlledId === undefined) setOwnId(id);
    onSelect?.(id);
  };

  return (
    <CSPProvider disableStyleElements>
      <BaseTabs.Root
        value={selectedId}
        onValueChange={(value) => {
          if (typeof value === 'string' && value !== selectedId) select(value);
        }}
        className={cx(styles.tabs, className)}
      >
        <BaseTabs.List
          aria-label={label}
          activateOnFocus={activation === 'automatic'}
          onKeyDown={skipDisabled}
          className={styles.list}
        >
          {tabs.map((tab) => (
            <BaseTabs.Tab
              key={tab.id}
              value={tab.id}
              disabled={tab.disabled}
              className={styles.tab}
            >
              {tab.label}
            </BaseTabs.Tab>
          ))}
        </BaseTabs.List>
        {tabs.map((tab) => (
          <BaseTabs.Panel
            key={tab.id}
            value={tab.id}
            keepMounted
            className={styles.panel}
          >
            {tab.content}
          </BaseTabs.Panel>
        ))}
      </BaseTabs.Root>
    </CSPProvider>
  );
}

const NAV_KEYS = new Set(['ArrowRight', 'ArrowLeft', 'Home', 'End']);

/**
 * Arrow/Home/End move focus over the enabled tabs only (wrapping). Focusing a tab is enough:
 * Base UI highlights it and, with `activateOnFocus`, selects it.
 */
function skipDisabled(
  event: KeyboardEvent<HTMLDivElement> & { preventBaseUIHandler?: () => void },
) {
  if (!NAV_KEYS.has(event.key)) return;
  const enabled = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(
      '[role="tab"]:not([data-disabled])',
    ),
  );
  const current = enabled.indexOf(document.activeElement as HTMLElement);
  if (current === -1) return;
  const last = enabled.length - 1;
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? last
        : event.key === 'ArrowRight'
          ? current === last
            ? 0
            : current + 1
          : current === 0
            ? last
            : current - 1;
  event.preventDefault();
  event.preventBaseUIHandler?.();
  enabled[next].focus();
}
