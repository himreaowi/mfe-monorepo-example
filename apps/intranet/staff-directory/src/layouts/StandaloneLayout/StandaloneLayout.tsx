import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import { MainLayout } from '@org/ui';
import { APP_TITLE } from '@/core/constants/app';

/** Chrome for standalone mode only. In the shell, the shell's layout is used. */
export function StandaloneLayout({ children }: { children: ReactNode }) {
  return (
    <MainLayout
      brand={`${APP_TITLE} (standalone)`}
      nav={
        <NavLink to="/" end>
          All staff
        </NavLink>
      }
    >
      {children}
    </MainLayout>
  );
}
