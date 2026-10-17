#!/usr/bin/env node
// @ts-check
/**
 * Repo guardrails: `pnpm check` (also part of `pnpm lint`).
 *   check.js [--only versions|apps] [--root <dir>]
 */
import path from 'node:path';
import { parseArgs } from 'node:util';
import { checkApps, checkVersions, formatReport } from '../src/index.js';

const { values } = parseArgs({
  options: {
    only: { type: 'string' },
    root: { type: 'string' },
  },
});
const root = path.resolve(
  values.root ?? path.join(import.meta.dirname, '..', '..', '..'),
);
const all = {
  'check-versions': () => checkVersions({ root }),
  'check-apps': () => checkApps({ root }),
};
const selected = values.only
  ? Object.entries(all).filter(([name]) => name === `check-${values.only}`)
  : Object.entries(all);
if (selected.length === 0) {
  console.error(`Unknown --only "${values.only}" (use versions or apps).`);
  process.exit(2);
}
/** @type {{ errors: import('../src/check-versions.js').Issue[], warnings: import('../src/check-versions.js').Issue[] }} */
const result = { errors: [], warnings: [] };
for (const [, run] of selected) {
  const r = await run();
  result.errors.push(...r.errors);
  result.warnings.push(...r.warnings);
}
const report = formatReport(
  result,
  selected.map(([n]) => n),
);
if (result.errors.length > 0) {
  console.error(report);
  process.exitCode = 1;
} else {
  console.log(report);
}
