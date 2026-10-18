// @ts-check
import { ZONES, toolPort } from '@org/scripts/zones';
import { createInternetApi } from './internet.js';
import { createIntranetApi } from './intranet.js';
import { createItemsResource } from './items.js';
import { createApiServer } from './server.js';

export {
  createApiServer,
  json,
  matchPath,
  notFound,
  validationError,
} from './server.js';

/**
 * Resources of each zone's mock API. Add your own (`{ routes, reset }`, see items.js) to the
 * zone(s) that use them; zones share nothing, like the real backends.
 * Example: the Staff Portal / Citizen Portal domain APIs (intranet.js, internet.js); the
 * template's `items` resource stays so a newly generated remote's demo feature works.
 * @type {Record<string, (zone: string) => import('./server.js').MockResource[]>}
 */
export const ZONE_RESOURCES = {
  intranet: (zone) => [createIntranetApi(), createItemsResource(zone)],
  internet: (zone) => [createInternetApi(), createItemsResource(zone)],
};

/** Dev port of a zone's mock API (the zone's tools range: intranet 3190, internet 3290). */
export function mockApiPort(/** @type {string} */ zone) {
  if (!Object.hasOwn(ZONES, zone)) {
    throw new Error(
      `mock-api: unknown zone "${zone}" (use ${Object.keys(ZONES).join(', ')})`,
    );
  }
  return toolPort(
    /** @type {import('@org/scripts/zones').Zone} */ (zone),
    'mockApi',
  );
}

/**
 * @param {string} zone
 * @param {{ delayMs?: number, log?: boolean }} [options]
 */
export function createMockApi(zone, options = {}) {
  const resources = ZONE_RESOURCES[zone];
  if (!resources) throw new Error(`mock-api: unknown zone "${zone}"`);
  return createApiServer({ zone, resources: resources(zone), ...options });
}
