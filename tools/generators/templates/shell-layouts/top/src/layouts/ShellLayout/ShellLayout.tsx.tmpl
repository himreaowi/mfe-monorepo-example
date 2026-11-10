import { useCallback, useId, useRef, useState } from 'react';
import { Outlet } from 'react-router';
import { UserMenu } from '@org/auth';
import { useOnlineStatus } from '@org/pwa';
import {
  Brand,
  ConnectionRequired,
  MenuDisclosure,
  SkipLink,
  ThemeToggle,
  useFitLayout,
  type FitLayout,
} from '@org/ui';
import { RemoteNav } from '@/components/RemoteNav/RemoteNav';
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
 * toggle and user menu fold into a panel behind a "Menu" button (`MenuDisclosure`: Escape,
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
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const onLayoutChange = useCallback((next: FitLayout) => {
    if (next === 'wide') setMenuOpen(false);
  }, []);
  const layout = useFitLayout({
    container: headerRef,
    sizer: sizerRef,
    panel: panelRef,
    button: menuButtonRef,
    open: menuOpen,
    onChange: onLayoutChange,
  });

  return (
    <div className={styles.host}>
      <SkipLink targetId={mainId} />
      <MenuDisclosure.Root
        ref={headerRef}
        open={menuOpen}
        onOpenChange={setMenuOpen}
        render={
          <header
            className={styles.header}
            data-layout={layout}
            data-nav-placement="top"
            data-testid="main-header"
          />
        }
      >
        <div ref={sizerRef} className={styles.sizer} aria-hidden="true" />
        <Brand className={styles.brand} data-testid="header-brand">
          {APP_TITLE}
        </Brand>
        <MenuDisclosure.Button
          ref={menuButtonRef}
          className={styles.menuButton}
          data-testid="header-menu-button"
        >
          <span aria-hidden="true" className={styles.menuIcon} />
          Menu
        </MenuDisclosure.Button>
        <MenuDisclosure.Panel
          ref={panelRef}
          className={menuOpen ? `${styles.panel} ${styles.open}` : styles.panel}
          data-testid="header-panel"
        >
          <nav className={styles.nav} aria-label="Main">
            <RemoteNav remotes={remotes} />
          </nav>
          <div className={styles.actions}>
            <ThemeToggle />
            <UserMenu />
          </div>
        </MenuDisclosure.Panel>
      </MenuDisclosure.Root>
      <ConnectionRequired visible={!online} />
      <main id={mainId} tabIndex={-1} className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
