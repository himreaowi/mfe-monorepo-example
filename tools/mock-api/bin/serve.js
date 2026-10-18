#!/usr/bin/env node
// @ts-check
/**
 * DEV ONLY: serves the mock API of one zone.
 *   mock-api --zone intranet|internet [--port <n>] [--delay <ms>]
 * Default port: the zone's mock API port (intranet 3190, internet 3290); each shell's
 * mfe-manifest.dev.json points settings.apiBaseUrl at http://localhost:<port>/api.
 * MOCK_API_DELAY=<ms> adds latency, MOCK_API_LOG=1 logs requests.
 * Started by `pnpm dev:<zone>` through the apps' Nx task dependency (target `serve:<zone>`).
 */
import { parseArgs } from 'node:util';
import { createMockApi, mockApiPort } from '../src/index.js';

const { values } = parseArgs({
  options: {
    zone: { type: 'string' },
    port: { type: 'string' },
    delay: { type: 'string' },
  },
});
const zone = values.zone ?? '';
let port;
try {
  port = Number(values.port ?? mockApiPort(zone));
} catch (error) {
  console.error(/** @type {Error} */ (error).message);
  process.exit(2);
}
const delayMs = Number(values.delay ?? process.env.MOCK_API_DELAY ?? 0);

createMockApi(zone, { delayMs, log: process.env.MOCK_API_LOG === '1' }).listen(
  port,
  () => {
    console.log(`mock ${zone} API (dev only) on http://localhost:${port}/api`);
  },
);
