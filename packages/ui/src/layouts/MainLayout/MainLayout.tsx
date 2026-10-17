import type { ReactNode } from 'react';
import { Outlet } from 'react-router';
import { useOnlineStatus } from '@org/pwa';
import { ThemeToggle } from '../../components/ThemeToggle';
import { ConnectionRequired } from '../../components/ConnectionRequired';
import styles from './MainLayout.module.scss';

export type MainLayoutProps = {
  /** Header brand. */
  brand?: ReactNode;
  /** Optional navigation rendered in the header, between brand and theme toggle. */
  nav?: ReactNode;
  /** Extra header content after the theme toggle (e.g. user menu). */
  headerActions?: ReactNode;
  /** Page content. Default: `<Outlet />` (use MainLayout as a route element). */
  children?: ReactNode;
  /** Override online detection (default: `useOnlineStatus()`). */
  online?: boolean;
};

/** App chrome: header (brand, nav, theme toggle), offline banner, main. */
export function MainLayout({
  brand = 'MFE Starter',
  nav,
  headerActions,
  children,
  online,
}: MainLayoutProps) {
  const detectedOnline = useOnlineStatus();
  const isOnline = online ?? detectedOnline;

  return (
    <div className={styles.host}>
      <header className={styles.header}>
        <div className={styles.brand}>{brand}</div>
        {nav ? <nav className={styles.nav}>{nav}</nav> : null}
        <div className={styles.actions}>
          <ThemeToggle />
          {headerActions}
        </div>
      </header>
      <ConnectionRequired visible={!isOnline} />
      <main className={styles.main}>{children ?? <Outlet />}</main>
    </div>
  );
}
