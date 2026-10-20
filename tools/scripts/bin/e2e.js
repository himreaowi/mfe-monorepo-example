#!/usr/bin/env node
// @ts-check
/**
 * `pnpm e2e` / `pnpm e2e:<zone>`: run each zone's e2e suite (in its shell), one zone at a time.
 *   e2e.js [--zone=<zone>] [any Playwright option, e.g. --project=desktop --grep=a11y]
 * One zone at a time: each suite starts that zone's dev servers and stops them afterwards.
 * A zone without a shell is skipped. Exit code 1 if any zone failed. Regenerates every shell's
 * mfe-manifest.dev.json first (src/dev-manifest.js).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ZONES } from '../src/zones.js';
import { listApps } from '../src/apps.js';
import { shellDirs, writeDevManifest } from '../src/dev-manifest.js';

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
if (zone !== undefined && !Object.hasOwn(ZONES, zone)) {
  console.error(
    `e2e: unknown zone "${zone}". Use one of: ${Object.keys(ZONES).join(', ')}.`,
  );
  process.exit(2);
}

const shells = listApps({ root, zone })
  .filter((app) => app.type === 'shell')
  .map((app) => ({
    name: app.package,
    zone: app.zone,
    hasE2e: Boolean(
      JSON.parse(
        fs.readFileSync(path.join(root, app.path, 'package.json'), 'utf8'),
      ).scripts?.e2e,
    ),
  }));

if (shells.length === 0) {
  console.log(
    `e2e: no shell${zone ? ` in the ${zone} zone` : ''}, nothing to test. Create one with: pnpm gen:shell ${zone ?? '<zone>'}`,
  );
  process.exit(0);
}

// the suites read (and the dev servers serve) the generated dev manifests: bring them up to date
for (const dir of shellDirs(root)) {
  const { file, changed } = writeDevManifest(root, dir);
  if (changed) console.log(`e2e: regenerated ${path.relative(root, file)}`);
}

/** @type {{ zone: string, status: string }[]} */
const results = [];
for (const shell of shells) {
  if (!shell.hasE2e) {
    console.log(`e2e: ${shell.name} has no "e2e" script, skipped.`);
    results.push({ zone: shell.zone, status: 'skipped (no e2e script)' });
    continue;
  }
  console.log(`\n=== e2e ${shell.zone} (${shell.name}) ===\n`);
  const run = spawnSync(
    'pnpm',
    ['--filter', shell.name, 'run', 'e2e', ...passThrough],
    { cwd: root, stdio: 'inherit' },
  );
  results.push({
    zone: shell.zone,
    status: run.status === 0 ? 'passed' : `failed (exit ${run.status})`,
  });
}

console.log('\ne2e summary:');
for (const r of results) console.log(`  ${r.zone}: ${r.status}`);
if (results.some((r) => r.status.startsWith('failed'))) process.exitCode = 1;
