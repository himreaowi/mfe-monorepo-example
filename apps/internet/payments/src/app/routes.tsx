import type { RouteObject } from 'react-router';
import { OverviewPage } from '@/pages/OverviewPage';

/**
 * The vendor module owns every path below `/payments/*` in the shell (`/` standalone): it
 * gets the sub-path as `props.path` and routes on it itself.
 */
export const routes: RouteObject[] = [{ path: '*', element: <OverviewPage /> }];
