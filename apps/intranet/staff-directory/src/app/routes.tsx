import type { RouteObject } from 'react-router';
import { routePaths } from '@/core/constants/routePaths';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { OverviewPage } from '@/pages/OverviewPage';
import { StaffDetailPage } from '@/pages/StaffDetailPage';

/** Relative routes: below `/staff-directory/*` in the shell, from `/` standalone. */
export const routes: RouteObject[] = [
  { index: true, element: <OverviewPage /> },
  { path: routePaths.detail, element: <StaffDetailPage /> },
  { path: '*', element: <NotFoundPage /> },
];
