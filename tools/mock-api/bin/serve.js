#!/usr/bin/env node
// @ts-check
/**
 * DEV ONLY: serves the mock API of one zone.
 *   mock-api --zone intranet|internet [--port <n>] [--delay <ms>]
 * Defaults: intranet :3910, internet :3920 (each shell's mfe-manifest.dev.json points
 * settings.apiBaseUrl at http://localhost:<port>/api). MOCK_API_DELAY=<ms> adds latency.
 * Started by `pnpm dev:<zone>` through the remotes' nx dev dependsOn.
 */
import { parseArgs } from 'node:util';
import { createMockApi, DEFAULT_PORTS } from '../src/index.js';

const { values } = parseArgs({
  options: {
    zone: { type: 'string' },
    port: { type: 'string' },
    delay: { type: 'string' },
  },
});
const zone = values.zone ?? '';
if (!Object.hasOwn(DEFAULT_PORTS, zone)) {
  console.error(
    `mock-api: --zone must be one of ${Object.keys(DEFAULT_PORTS).join(', ')}`,
  );
  process.exit(2);
}
const port = Number(
  values.port ??
    DEFAULT_PORTS[/** @type {keyof typeof DEFAULT_PORTS} */ (zone)],
);
const delayMs = Number(values.delay ?? process.env.MOCK_API_DELAY ?? 0);

createMockApi(zone, { delayMs, log: process.env.MOCK_API_LOG === '1' }).listen(
  port,
  () => {
    console.log(`mock ${zone} API (dev only) on http://localhost:${port}/api`);
  },
);
