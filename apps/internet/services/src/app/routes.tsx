import type { RouteObject } from 'react-router';
import { routePaths } from '@/core/constants/routePaths';
import { NotFoundPage } from '@/pages/NotFoundPage/NotFoundPage';
import { OverviewPage } from '@/pages/OverviewPage/OverviewPage';
import { ServicePage } from '@/pages/ServicePage/ServicePage';

/** Relative routes: below `/services/*` in the shell, from `/` standalone. */
export const routes: RouteObject[] = [
  { index: true, element: <OverviewPage /> },
  { path: routePaths.service, element: <ServicePage /> },
  { path: '*', element: <NotFoundPage /> },
];
