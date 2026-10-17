import { UserMenu } from '@org/auth';
import { MainLayout } from '@org/ui';
import { RemoteNav } from '@/components/RemoteNav';
import { APP_TITLE } from '@/core/constants/app';
import type { RemoteEntry } from '@/core/types/remotes';

/**
 * App chrome: MainLayout from @org/ui (brand, theme toggle, offline banner) with the remotes
 * nav and the sign-in / user menu. Renders the matched route through <Outlet />.
 */
export function ShellLayout({ remotes }: { remotes: RemoteEntry[] }) {
  return (
    <MainLayout
      brand={APP_TITLE}
      nav={<RemoteNav remotes={remotes} />}
      headerActions={<UserMenu />}
    />
  );
}
