import { useCallback, useId, useRef } from 'react';
import { Outlet } from 'react-router';
import { UserMenu } from '@org/auth';
import { useOnlineStatus } from '@org/pwa';
import {
  Brand,
  ConnectionRequired,
  SkipLink,
  ThemeToggle,
  useFitLayout,
  useMenuDisclosure,
  type FitLayout,
} from '@org/ui';
import { RemoteNav } from '@/components/RemoteNav';
import { APP_TITLE } from '@/core/constants/app';
import type { RemoteEntry } from '@/core/types/remotes';
import styles from './ShellLayout.module.scss';

/**
 * The shell's chrome (generated from the "top" starter; this is your code now): skip link,
 * header (brand, remotes nav, theme toggle, user menu), offline banner and `<main>` with the
 * matched route (`<Outlet />`).
 *
 * The header is always ONE row. When brand, nav and actions do not fit side by side (measured
 * with `useFitLayout`, so it also happens on wide screens with many remotes), the nav, theme
 * toggle and user menu fold into a panel behind a "Menu" button (`useMenuDisclosure`: Escape,
 * outside click, followed link and back/forward close it; focus returns to the button).
 *
 * Colours and spacing: ShellLayout.module.scss (see "HEADER COLOURS" there). Structure: edit
 * the JSX below; to put the nav in a sidebar, compare with the "side" starter
 * (tools/generators/templates/shell-layouts/side at the repo root).
 *
 * The generated e2e suite (e2e/helpers.ts) relies on: `data-testid` main-header (with
 * `data-layout` and `data-nav-placement`), header-brand, header-menu-button, header-panel; the
 * "Menu" button name; the `<nav>` named "Main" holding RemoteNav ("Apps" list); one `<main>`.
 * Keep them, or adapt e2e/helpers.ts when you change the structure.
 */
export function ShellLayout({ remotes }: { remotes: RemoteEntry[] }) {
  const online = useOnlineStatus();
  const mainId = useId();
  const sizerRef = useRef<HTMLDivElement>(null);
  const menu = useMenuDisclosure();
  const { setOpen } = menu;
  const onLayoutChange = useCallback(
    (next: FitLayout) => {
      if (next === 'wide') setOpen(false);
    },
    [setOpen],
  );
  const layout = useFitLayout({
    container: menu.containerRef,
    sizer: sizerRef,
    panel: menu.panelRef,
    button: menu.buttonRef,
    open: menu.open,
    onChange: onLayoutChange,
  });

  return (
    <div className={styles.host}>
      <SkipLink targetId={mainId} />
      <header
        ref={menu.containerRef}
        className={styles.header}
        data-layout={layout}
        data-nav-placement="top"
        data-testid="main-header"
      >
        <div ref={sizerRef} className={styles.sizer} aria-hidden="true" />
        <Brand className={styles.brand} data-testid="header-brand">
          {APP_TITLE}
        </Brand>
        <button
          {...menu.buttonProps}
          className={styles.menuButton}
          data-testid="header-menu-button"
        >
          <span aria-hidden="true" className={styles.menuIcon} />
          Menu
        </button>
        <div
          {...menu.panelProps}
          className={
            menu.open ? `${styles.panel} ${styles.open}` : styles.panel
          }
          data-testid="header-panel"
        >
          <nav className={styles.nav} aria-label="Main">
            <RemoteNav remotes={remotes} />
          </nav>
          <div className={styles.actions}>
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>
      <ConnectionRequired visible={!online} />
      <main id={mainId} tabIndex={-1} className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
