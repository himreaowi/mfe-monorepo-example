import { useId } from 'react';
import type { ReactNode } from 'react';
import { Brand, SkipLink, ThemeToggle } from '@org/ui';
import { APP_TITLE } from '@/core/constants/app';
import styles from './StandaloneLayout.module.scss';

/**
 * Chrome for standalone mode only (`pnpm dev` in this folder): skip link, a simple header
 * (brand, theme toggle) and `<main>`. In the shell, the shell's own layout is used and this
 * component is not rendered. Edit freely: it is this adapter's code.
 */
export function StandaloneLayout({ children }: { children: ReactNode }) {
  const mainId = useId();
  return (
    <div className={styles.host}>
      <SkipLink targetId={mainId} />
      <header className={styles.header}>
        <Brand className={styles.brand}>{`${APP_TITLE} (standalone)`}</Brand>
        <ThemeToggle />
      </header>
      <main id={mainId} tabIndex={-1} className={styles.main}>
        {children}
      </main>
    </div>
  );
}
