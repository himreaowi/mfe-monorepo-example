import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { Outlet } from 'react-router';
import { useOnlineStatus } from '@org/pwa';
import { ThemeToggle } from '../../components/ThemeToggle';
import { ConnectionRequired } from '../../components/ConnectionRequired';
import styles from './MainLayout.module.scss';
import { NavPlacementContext } from './navPlacement';
import type { NavPlacement } from './navPlacement';
import { useHeaderLayout } from './useHeaderLayout';
import type { HeaderLayout } from './useHeaderLayout';

export type MainLayoutProps = {
  /**
   * Header brand: text or inline content (e.g. a home link). Always one line: a name longer than
   * the space left truncates with an ellipsis on screen while the DOM text (and so the
   * accessible name) stays whole. Show the full name elsewhere too (home page `<h1>`, document
   * title).
   */
  brand?: ReactNode;
  /**
   * Optional navigation: in the header row between brand and theme toggle (`navPlacement`
   * `top`), or in a sidebar left of the content (`side`). Behind the Menu button when there is
   * no room.
   */
  nav?: ReactNode;
  /**
   * Where `nav` goes on wide screens. `top` (default): in the header row. `side`: a vertical
   * sidebar (16rem) under a sticky top bar with brand, theme toggle and `headerActions`; below
   * 56rem of width (or when the top bar does not fit) the sidebar becomes a drawer behind the
   * Menu button. Content can read it with `useNavPlacement()`.
   */
  navPlacement?: NavPlacement;
  /** Accessible name of the `<nav>` landmark. Default `Main`. */
  navLabel?: string;
  /** Extra header content after the theme toggle (e.g. user menu). */
  headerActions?: ReactNode;
  /** Text of the narrow-screen menu button. Default `Menu`. */
  menuLabel?: string;
  /** Text of the skip link (first focusable element, visible on focus). Default `Skip to main content`. */
  skipLinkLabel?: string;
  /** Page content. Default: `<Outlet />` (use MainLayout as a route element). */
  children?: ReactNode;
  /** Override online detection (default: `useOnlineStatus()`). */
  online?: boolean;
};

/**
 * App chrome: header (brand, nav, theme toggle, actions), offline banner, main.
 *
 * The header is always one row. When brand, nav and actions do not fit side by side (measured,
 * see `useHeaderLayout`: any number of nav items, signed in or not, any width), the nav, theme
 * toggle and actions fold into a panel behind a "Menu" disclosure button (`aria-expanded`,
 * `aria-controls`); before the first measurement and without ResizeObserver a CSS breakpoint
 * (40rem) decides. The panel closes on Escape (focus returns to the button), on a click outside
 * the header, and after a link inside it is followed (or on browser back/forward). The current
 * layout is on the header as `data-layout="wide|compact"`. The brand never wraps: it shrinks
 * first and truncates with an ellipsis (screen readers still get the full text).
 *
 * `navPlacement="side"`: the header is a sticky top bar (brand, theme toggle, actions) and the
 * nav a sidebar below it on the left (its own scrolling); the same measurement decides, with a
 * minimum of sidebar + 40rem content (56rem in all), and compact shows the panel as a drawer on
 * the left. The nav stays inside the header (`<header>` is the banner landmark in both
 * placements), so there is one nav element, one panel and one set of header colour tokens.
 * The placement is on the header as `data-nav-placement` and in context (`useNavPlacement`).
 *
 * A skip link ("Skip to main content", visible on focus) comes first in both placements.
 */
export function MainLayout({
  brand = 'MFE Starter',
  nav,
  navLabel = 'Main',
  headerActions,
  menuLabel = 'Menu',
  navPlacement = 'top',
  skipLinkLabel = 'Skip to main content',
  children,
  online,
}: MainLayoutProps) {
  const detectedOnline = useOnlineStatus();
  const isOnline = online ?? detectedOnline;
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const mainId = useId();
  const mainRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const sizerRef = useRef<HTMLDivElement>(null);
  const onLayoutChange = useCallback((next: HeaderLayout) => {
    if (next === 'wide') setOpen(false);
  }, []);
  const layout = useHeaderLayout(
    { header: headerRef, sizer: sizerRef, panel: panelRef, button: buttonRef },
    open,
    onLayoutChange,
  );

  /** Close; if focus was inside the panel (about to be hidden), move it to the button. */
  const close = useCallback((restoreFocus: boolean) => {
    const panel = panelRef.current;
    const focusInside =
      panel !== null && panel.contains(document.activeElement);
    setOpen(false);
    if (restoreFocus || focusInside) buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(true);
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && headerRef.current?.contains(target)) return;
      close(false);
    };
    const onPopState = () => close(false);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('popstate', onPopState);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('popstate', onPopState);
    };
  }, [open, close]);

  // focus the main region without changing the URL (a `#id` fragment would be a router navigation)
  const onSkip = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    mainRef.current?.focus();
  };

  // a followed link (client-side navigation) closes the panel
  const onPanelClick = (event: MouseEvent<HTMLDivElement>) => {
    if (open && (event.target as Element).closest('a[href]')) close(false);
  };

  const navElement = nav ? (
    <nav key="nav" className={styles.nav} aria-label={navLabel}>
      {nav}
    </nav>
  ) : null;
  const actionsElement = (
    <div key="actions" className={styles.actions}>
      <ThemeToggle />
      {headerActions}
    </div>
  );
  // DOM (= keyboard) order follows the visual order: top bar before sidebar when the side nav
  // is shown as a sidebar; nav first in the header row and in the Menu panel / drawer. Keyed,
  // so React moves the nodes instead of remounting them.
  const panelContent =
    navPlacement === 'side' && layout === 'wide'
      ? [actionsElement, navElement]
      : [navElement, actionsElement];

  return (
    <div className={styles.host}>
      <a href={`#${mainId}`} className={styles.skipLink} onClick={onSkip}>
        {skipLinkLabel}
      </a>
      <header
        ref={headerRef}
        className={
          navPlacement === 'side'
            ? `${styles.header} ${styles.side}`
            : styles.header
        }
        data-layout={layout}
        data-nav-placement={navPlacement}
        data-testid="main-header"
      >
        <div ref={sizerRef} className={styles.sizer} aria-hidden="true" />
        {/* no `title` tooltip on purpose: see README "Long brand names" */}
        <div className={styles.brand} data-testid="header-brand">
          {brand}
        </div>
        <button
          ref={buttonRef}
          type="button"
          className={styles.menuButton}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
          data-testid="header-menu-button"
        >
          <span aria-hidden="true" className={styles.menuIcon} />
          {menuLabel}
        </button>
        {/* click delegation only: links inside handle keyboard activation themselves */}
        <div
          ref={panelRef}
          id={panelId}
          className={open ? `${styles.panel} ${styles.open}` : styles.panel}
          onClick={onPanelClick}
          data-testid="header-panel"
        >
          <NavPlacementContext.Provider value={navPlacement}>
            {panelContent}
          </NavPlacementContext.Provider>
        </div>
      </header>
      <ConnectionRequired visible={!isOnline} />
      <main ref={mainRef} id={mainId} tabIndex={-1} className={styles.main}>
        {children ?? <Outlet />}
      </main>
    </div>
  );
}
