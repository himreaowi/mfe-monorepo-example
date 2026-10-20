import type { RouteObject } from 'react-router';
import { NotFoundPage } from '@/pages/NotFoundPage/NotFoundPage';
import { OverviewPage } from '@/pages/OverviewPage/OverviewPage';

/** Relative routes: below `/my-profile/*` in the shell, from `/` standalone. */
export const routes: RouteObject[] = [
  { index: true, element: <OverviewPage /> },
  { path: '*', element: <NotFoundPage /> },
];
