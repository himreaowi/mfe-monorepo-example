import type { RouteObject } from 'react-router';
import { routePaths } from '@/core/constants/routePaths';
import { NewLeavePage } from '@/pages/NewLeavePage/NewLeavePage';
import { NotFoundPage } from '@/pages/NotFoundPage/NotFoundPage';
import { OverviewPage } from '@/pages/OverviewPage/OverviewPage';

/** Relative routes: below `/leave-requests/*` in the shell, from `/` standalone. */
export const routes: RouteObject[] = [
  { index: true, element: <OverviewPage /> },
  { path: routePaths.newRequest, element: <NewLeavePage /> },
  { path: '*', element: <NotFoundPage /> },
];
