import type { RouteObject } from 'react-router';
import { ShellLayout } from '@/layouts/ShellLayout';
import { HomePage } from '@/pages/HomePage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { RemotePage } from '@/pages/RemotePage';
import { remoteMountPath } from '@/core/constants/routePaths';
import type { RemoteEntry } from '@/core/types/remotes';

/** Shell routes: layout + home + one splat route per remote (`/<remote>/*`) + 404. */
export function createRoutes(remotes: RemoteEntry[]): RouteObject[] {
  return [
    {
      element: <ShellLayout remotes={remotes} />,
      children: [
        { index: true, element: <HomePage remotes={remotes} /> },
        ...remotes.map((remote) => ({
          path: remoteMountPath(remote),
          element: <RemotePage remote={remote} />,
        })),
        { path: '*', element: <NotFoundPage /> },
      ],
    },
  ];
}
