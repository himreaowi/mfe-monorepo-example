import { useCallback, useId, useRef, useState, type ReactNode } from 'react';
import { Outlet } from 'react-router';
import { UserMenu } from '@org/auth';
import { useOnlineStatus } from '@org/pwa';
import {
  Brand,
  ConnectionRequired,
  MenuDisclosure,
  MenuIcon,
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
 * The shell's chrome (generated from the "side" starter; this is your code now): skip link,
 * a sticky top bar (brand, theme toggle, user menu), the remotes nav as a sidebar on the left,
 * offline banner and `<main>` with the matched route (`<Outlet />`).
 *
 * Wide (measured with `useFitLayout`: the top bar row fits AND the viewport leaves 40rem for
 * the content next to the 16rem sidebar, so from 56rem = 896 px): sidebar. Otherwise compact:
 * brand + "Menu" button, and the panel (nav, theme toggle, user menu) opens as a drawer on the
 * left (`MenuDisclosure`: Escape, outside click, followed link and back/forward close it;
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
      <MenuDisclosure.Root
        ref={headerRef}
        open={menuOpen}
        onOpenChange={setMenuOpen}
        render={
          <header
            className={`${styles.header} ${styles.side}`}
            data-layout={layout}
            data-nav-placement="side"
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
          <MenuIcon size="sm" />
          Menu
        </MenuDisclosure.Button>
        <MenuDisclosure.Panel
          ref={panelRef}
          className={menuOpen ? `${styles.panel} ${styles.open}` : styles.panel}
          data-testid="header-panel"
        >
          {panelContent}
        </MenuDisclosure.Panel>
      </MenuDisclosure.Root>
      <ConnectionRequired visible={!online} />
      <main id={mainId} tabIndex={-1} className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}

/**
 * The chrome while signed out of a shell that requires sign-in (SIGN_IN_REQUIRED,
 * src/core/constants/signIn.ts; passed to `SignInGate` from @org/auth in src/app/App.tsx): skip link, a header with
 * the brand only, offline banner and `<main>` with the spinner or the landing page. No nav and
 * no remotes. The saved theme still applies (ThemeProvider is above this).
 */
export function SignedOutLayout({ children }: { children: ReactNode }) {
  const online = useOnlineStatus();
  const mainId = useId();
  return (
    <div className={styles.host}>
      <SkipLink targetId={mainId} />
      <header
        className={styles.header}
        data-layout="signed-out"
        data-nav-placement="side"
        data-testid="main-header"
      >
        <Brand className={styles.brand} data-testid="header-brand">
          {APP_TITLE}
        </Brand>
        {/*
         * SIGNED-OUT HEADER: brand only. No Menu button, nav, sign-in button or user menu (the
         * landing page has the one sign-in button) and no theme toggle. To offer the theme toggle
         * before sign-in, add it here:
         *   <div className={styles.actions}><ThemeToggle /></div>
         */}
      </header>
      <ConnectionRequired visible={!online} />
      <main id={mainId} tabIndex={-1} className={styles.main}>
        {children}
      </main>
    </div>
  );
}
