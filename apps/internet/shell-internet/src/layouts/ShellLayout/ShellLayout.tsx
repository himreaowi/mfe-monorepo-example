import { UserMenu } from '@org/auth';
import { MainLayout, type NavPlacement } from '@org/ui';
import { RemoteNav } from '@/components/RemoteNav';
import { APP_TITLE } from '@/core/constants/app';
import type { RemoteEntry } from '@/core/types/remotes';

/**
 * Where the remotes nav goes on wide screens: 'top' (in the header row) or 'side' (a sidebar
 * left of the content). Both fold behind the "Menu" button when there is no room (phones).
 * Set by `pnpm gen:shell <zone> --layout top|side`; change it here (the only place).
 * See docs/ui-context.md "Navigation placement" at the repo root.
 */
const NAV_PLACEMENT: NavPlacement = 'top';

/**
 * App chrome: MainLayout from @org/ui (brand, theme toggle, offline banner) with the remotes
 * nav and the sign-in / user menu. Renders the matched route through <Outlet />.
 */
export function ShellLayout({ remotes }: { remotes: RemoteEntry[] }) {
  return (
    <MainLayout
      brand={APP_TITLE}
      nav={<RemoteNav remotes={remotes} />}
      navPlacement={NAV_PLACEMENT}
      headerActions={<UserMenu />}
    />
  );
}
