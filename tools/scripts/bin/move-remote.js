#!/usr/bin/env node
// @ts-check
/**
 * `pnpm move-remote <zone> <remote> --to shared|<shellName> [--dry-run]` (src/move-remote.js).
 * Moves a remote to where the `remote-location` check wants it (apps/<zone>/<shell>/<remote> when
 * one shell lists it, apps/<zone>/shared/<remote> for two or more).
 */
import path from 'node:path';
import { parseArgs } from 'node:util';
import { MoveError, moveRemote } from '../src/move-remote.js';

const USAGE = `Usage: pnpm move-remote <zone> <remote> --to shared|<shellName> [--dry-run]
  <zone>      intranet | internet
  <remote>    the remote's folder name (apps/<zone>/<group>/<remote>)
  --to        shared (listed by 2+ shells) or the name of the one shell that lists it
  --dry-run   print the plan, change nothing
  --root <dir>  workspace root (default: this repo)`;

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
  const [zone, remote, ...extra] = positionals;
  if (!zone || !remote || !values.to || extra.length > 0) {
    throw new MoveError(`Missing or extra arguments.\n\n${USAGE}`);
  }
  const root = path.resolve(
    values.root ?? path.join(import.meta.dirname, '..', '..', '..'),
  );
  const result = moveRemote({
    root,
    zone,
    remote,
    to: values.to,
    dryRun: values['dry-run'],
  });
  process.exitCode = result.checkStatus ? 1 : 0;
} catch (error) {
  if (
    error instanceof MoveError ||
    /** @type {any} */ (error)?.code?.startsWith?.('ERR_PARSE_ARGS')
  ) {
    console.error(`move-remote: ${/** @type {Error} */ (error).message}`);
    process.exit(2);
  }
  throw error;
}
