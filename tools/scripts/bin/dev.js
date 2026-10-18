#!/usr/bin/env node
// @ts-check
/**
 * `pnpm dev:<zone>`: start every dev server of a zone (shell, remotes, the zone's dev tools)
 * with `nx run-many -t dev`, and stop them cleanly (Ctrl-C, or Playwright's webServer SIGTERM
 * after `pnpm e2e`): one "dev servers stopped" line instead of Nx's misleading
 * "Tasks not run because their dependencies failed" summary. See src/launch.js.
 *   dev.js --zone=<zone> [extra nx run-many options]
 */
import path from 'node:path';
import { launch } from '../src/launch.js';
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

// exit explicitly: an orphaned grandchild must not keep the launcher alive via the pipes
process.exit(
  await launch({
    command: path.join(
      root,
      'node_modules',
      '.bin',
      isWindows ? 'nx.cmd' : 'nx',
    ),
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
  }),
);
