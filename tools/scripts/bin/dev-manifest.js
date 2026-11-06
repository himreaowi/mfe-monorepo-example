#!/usr/bin/env node
// @ts-check
/**
 * Generate the shells' `mfe-manifest.dev.json` from `remotes.json`, the remotes' package.json
 * `mfe.port` and the shell's package.json `mfe.devManifest` (src/dev-manifest.js).
 *   dev-manifest.js [--shell-dir <dir>] [--root <dir>]
 * Without --shell-dir: every shell of the workspace. Runs from `pnpm dev-manifest` (repo root),
 * every shell's `dev` script (`mfe-dev-manifest --shell-dir .`) and `pnpm e2e`.
 */
import path from 'node:path';
import { parseArgs } from 'node:util';
import { shellDirs, writeDevManifest } from '../src/dev-manifest.js';

const { values } = parseArgs({
  options: {
    'shell-dir': { type: 'string' },
    root: { type: 'string' },
  },
});
const root = path.resolve(
  values.root ?? path.join(import.meta.dirname, '..', '..', '..'),
);
const dirs = values['shell-dir']
  ? [path.resolve(values['shell-dir'])]
  : shellDirs(root);
for (const dir of dirs) {
  const { file, changed, problems } = writeDevManifest(root, dir);
  if (changed) console.log(`dev-manifest: wrote ${path.relative(root, file)}`);
  for (const problem of problems) {
    console.warn(
      `dev-manifest: ${path.relative(root, dir)}: skipped ${problem} (see pnpm check)`,
    );
  }
}
