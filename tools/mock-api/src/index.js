// @ts-check
import { createInternetApi } from './internet.js';
import { createIntranetApi } from './intranet.js';
import { createApiServer } from './server.js';

/** Dev ports of the zone mocks (outside the apps' 3100–3299 ranges). */
export const DEFAULT_PORTS = { intranet: 3910, internet: 3920 };

const FACTORIES = { intranet: createIntranetApi, internet: createInternetApi };

/**
 * @param {string} zone `intranet` | `internet`
 * @param {{ delayMs?: number, log?: boolean }} [options]
 */
export function createMockApi(zone, options = {}) {
  const factory = FACTORIES[/** @type {keyof typeof FACTORIES} */ (zone)];
  if (!factory) throw new Error(`mock-api: unknown zone "${zone}"`);
  return createApiServer({ zone, api: factory(), ...options });
}
