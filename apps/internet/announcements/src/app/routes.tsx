import type { RouteObject } from 'react-router';
import { routePaths } from '@/core/constants/routePaths';
import { AnnouncementPage } from '@/pages/AnnouncementPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { OverviewPage } from '@/pages/OverviewPage';

/** Relative routes: below `/announcements/*` in the shell, from `/` standalone. */
export const routes: RouteObject[] = [
  { index: true, element: <OverviewPage /> },
  { path: routePaths.announcement, element: <AnnouncementPage /> },
  { path: '*', element: <NotFoundPage /> },
];
