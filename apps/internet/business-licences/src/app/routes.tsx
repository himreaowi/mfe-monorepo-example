import type { RouteObject } from 'react-router';
import { routePaths } from '@/core/constants/routePaths';
import { DetailsPage } from '@/pages/DetailsPage/DetailsPage';
import { NotFoundPage } from '@/pages/NotFoundPage/NotFoundPage';
import { OverviewPage } from '@/pages/OverviewPage/OverviewPage';

/** Relative routes: below `/business-licences/*` in the shell, from `/` standalone. */
export const routes: RouteObject[] = [
  { index: true, element: <OverviewPage /> },
  { path: routePaths.details, element: <DetailsPage /> },
  { path: '*', element: <NotFoundPage /> },
];
