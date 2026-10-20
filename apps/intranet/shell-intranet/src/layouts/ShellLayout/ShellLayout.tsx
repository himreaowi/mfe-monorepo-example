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
import { RemoteNav } from '@/components/RemoteNav/RemoteNav';
import { APP_TITLE } from '@/core/constants/app';
import type { RemoteEntry } from '@/core/types/remotes';
import styles from './ShellLayout.module.scss';

/**
 * The shell's chrome (generated from the "side" starter; this is your code now): skip link,
 * a sticky top bar (brand, theme toggle, user menu), the remotes nav as a sidebar on the left,
 * offline banner and `<main>` with the matched route (`<Outlet />`).
 *
 * Wide (measured with `useFitLayout`: the top bar row fits AND the viewport leaves 40rem for
 * the content next to the 16rem sidebar, so from 56rem = 896 px): sidebar. Otherwise compact:
 * brand + "Menu" button, and the panel (nav, theme toggle, user menu) opens as a drawer on the
 * left (`useMenuDisclosure`: Escape, outside click, followed link and back/forward close it;
 * focus returns to the button). The nav stays inside `<header>` in both layouts: one banner
 * landmark, one `<nav>`, one panel, one set of header colours.
 *
 * Colours, widths and spacing: ShellLayout.module.scss (see "HEADER COLOURS" there).
 * Structure: edit the JSX below; to put the nav in the header row, compare with the "top"
 * starter (tools/generators/templates/shell-layouts/top at the repo root).
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

  const nav = (
    <nav key="nav" className={styles.nav} aria-label="Main">
      <RemoteNav remotes={remotes} orientation="vertical" />
    </nav>
  );
  const actions = (
    <div key="actions" className={styles.actions}>
      <ThemeToggle />
      <UserMenu />
    </div>
  );
  // DOM (= keyboard) order follows the visual order: top bar (theme toggle, user menu) before
  // the sidebar when wide; nav first in the drawer. Keyed, so React moves the nodes instead of
  // remounting them.
  const panelContent = layout === 'wide' ? [actions, nav] : [nav, actions];

  return (
    <div className={styles.host}>
      <SkipLink targetId={mainId} />
      <header
        ref={menu.containerRef}
        className={`${styles.header} ${styles.side}`}
        data-layout={layout}
        data-nav-placement="side"
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
          {panelContent}
        </div>
      </header>
      <ConnectionRequired visible={!online} />
      <main id={mainId} tabIndex={-1} className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
