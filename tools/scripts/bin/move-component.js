#!/usr/bin/env node
// @ts-check
/**
 * `pnpm move-component <app-package-or-path> <ComponentName> --to <zone>/libs/<capability> |
 * common/<capability> [--dry-run]` (src/move-component.js). Moves a component out of an app into
 * a code library (docs/where-code-goes.md).
 */
import path from 'node:path';
import { parseArgs } from 'node:util';
import { MoveComponentError, moveComponent } from '../src/move-component.js';

const USAGE = `Usage: pnpm move-component <app> <ComponentName> --to <zone>/libs/<capability> | common/<capability> [--dry-run]
  <app>            the app's package name (@org/intranet-staff) or folder (apps/intranet/staff/staff)
  <ComponentName>  the folder below the app's src/**/components/
  --to             <zone>/libs/<capability>: apps/<zone>/libs/<capability> (that zone's apps only)
                   common/<capability>: packages/common/<capability> (both zones; ships to the
                   public internet portals: no confidential or intranet-only rules)
                   The library must exist: pnpm gen:package <zone|common> <capability>
  --dry-run        print the plan, change nothing
  --root <dir>     workspace root (default: this repo)`;

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      to: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      root: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    console.log(USAGE);
    process.exit(0);
  }
  const [app, component, ...extra] = positionals.filter((p) => p !== '--');
  if (!app || !component || !values.to || extra.length > 0) {
    throw new MoveComponentError(`Missing or extra arguments.\n\n${USAGE}`);
  }
  const root = path.resolve(
    values.root ?? path.join(import.meta.dirname, '..', '..', '..'),
  );
  const result = moveComponent({
    root,
    app,
    component,
    to: values.to,
    dryRun: values['dry-run'],
  });
  process.exitCode = result.checkStatus ? 1 : 0;
} catch (error) {
  if (
    error instanceof MoveComponentError ||
    /** @type {any} */ (error)?.code?.startsWith?.('ERR_PARSE_ARGS')
  ) {
    console.error(`move-component: ${/** @type {Error} */ (error).message}`);
    process.exit(2);
  }
  throw error;
}
