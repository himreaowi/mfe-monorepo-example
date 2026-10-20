#!/usr/bin/env node
// @ts-check
/**
 * `pnpm dev:<zone>`: start every dev server of a zone (its shells, remotes and dev tools)
 * with `nx run-many -t dev`, plus the zone's dev proxy on the zone port (3100 / 3200, see
 * src/zone-proxy.js: each shell under its base path, `/` → the default shell), and stop them cleanly (Ctrl-C, or Playwright's webServer SIGTERM
 * after `pnpm e2e`): one "dev servers stopped" line instead of Nx's misleading
 * "Tasks not run because their dependencies failed" summary. See src/launch.js.
 *   dev.js --zone=<zone> [extra nx run-many options]
 */
import path from 'node:path';
import { launch } from '../src/launch.js';
import { startZoneProxy } from '../src/zone-proxy.js';
import { ZONES } from '../src/zones.js';

const root = path.resolve(import.meta.dirname, '..', '..', '..');

/** @type {string | undefined} */
let zone;
/** @type {string[]} */
const passThrough = [];
const argv = process.argv.slice(2).filter((a) => a !== '--');
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg.startsWith('--zone=')) zone = arg.slice('--zone='.length);
  else if (arg === '--zone') {
    zone = argv[i + 1];
    i += 1;
  } else passThrough.push(arg);
}
if (zone === undefined || !Object.hasOwn(ZONES, zone)) {
  console.error(
    `dev: pass --zone=<zone> (one of: ${Object.keys(ZONES).join(', ')}).`,
  );
  process.exit(2);
}

const isWindows = process.platform === 'win32';
// Output is piped (so it can be dropped while stopping): keep colours in a terminal.
const env = { ...process.env };
if (process.stdout.isTTY && env.FORCE_COLOR === undefined && !env.NO_COLOR) {
  env.FORCE_COLOR = '1';
}

/** @type {Awaited<ReturnType<typeof startZoneProxy>>} */
let proxy;
try {
  proxy = await startZoneProxy({
    root,
    zone,
    log: (line) => console.log(`dev:${zone}: ${line}`),
  });
} catch (error) {
  const e = /** @type {NodeJS.ErrnoException} */ (error);
  console.error(
    `dev:${zone}: cannot start the dev proxy on port ${ZONES[/** @type {keyof typeof ZONES} */ (zone)].proxy}: ${e.code === 'EADDRINUSE' ? 'the port is in use (another pnpm dev:' + zone + '?)' : e.message}`,
  );
  process.exit(1);
}

// exit explicitly: an orphaned grandchild must not keep the launcher alive via the pipes
const code = await launch({
  command: path.join(root, 'node_modules', '.bin', isWindows ? 'nx.cmd' : 'nx'),
  args: [
    'run-many',
    '-t',
    'dev',
    `--projects=tag:zone:${zone}`,
    '--parallel=100',
    '--outputStyle=stream',
    ...passThrough,
  ],
  cwd: root,
  env,
  shell: isWindows,
  label: `dev:${zone}`,
});
await proxy.close();
process.exit(code);
