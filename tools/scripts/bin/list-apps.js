#!/usr/bin/env node
// @ts-check
/**
 * `pnpm -s apps`: the workspace's apps, e.g. for a CI matrix.
 *   list-apps.js [--zone=<zone>] [--affected --base=<sha> [--head=<sha>]] [--json | --matrix]
 *
 * --json      JSON array of { name, package, zone, type, access, kind, port, federationName,
 *             path, distDir }
 * --matrix    JSON object keyed by federation name (Azure Pipelines `strategy.matrix` shape:
 *             string values only); `{}` when nothing is affected
 * --affected  only apps affected by changes since --base (Nx affected; git diff fallback).
 *             Without --head the working tree (incl. uncommitted files) is compared.
 *             --base/--head default to $NX_BASE/$NX_HEAD.
 * Use `pnpm -s` so pnpm prints nothing but the output.
 */
import path from 'node:path';
import { parseArgs } from 'node:util';
import { affectedApps, listApps } from '../src/apps.js';
import { ZONES } from '../src/zones.js';

const USAGE =
  'Usage: pnpm -s apps [--zone=<zone>] [--affected --base=<sha> [--head=<sha>]] [--json | --matrix]';

function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2).filter((a) => a !== '--'),
    options: {
      zone: { type: 'string' },
      affected: { type: 'boolean', default: false },
      base: { type: 'string' },
      head: { type: 'string' },
      json: { type: 'boolean', default: false },
      matrix: { type: 'boolean', default: false },
      root: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    console.log(USAGE);
    return;
  }
  const root = path.resolve(
    values.root ?? path.join(import.meta.dirname, '..', '..', '..'),
  );
  if (values.zone !== undefined && !Object.hasOwn(ZONES, values.zone)) {
    throw new Error(
      `unknown zone "${values.zone}". Use one of: ${Object.keys(ZONES).join(', ')}.`,
    );
  }
  let apps;
  if (values.affected) {
    const base = values.base ?? process.env.NX_BASE;
    const head = values.head ?? process.env.NX_HEAD;
    if (!base) {
      throw new Error(`--affected needs --base=<sha> (or NX_BASE).\n${USAGE}`);
    }
    const result = affectedApps({ root, base, head, zone: values.zone });
    apps = result.apps;
    if (!values.json && !values.matrix) {
      console.log(
        `Affected since ${base}${head ? `...${head}` : ' (working tree)'} (${result.source}):`,
      );
    }
  } else {
    apps = listApps({ root, zone: values.zone });
  }

  if (values.json) {
    console.log(JSON.stringify(apps, null, 2));
  } else if (values.matrix) {
    console.log(
      JSON.stringify(
        Object.fromEntries(
          apps.map((a) => [
            a.federationName,
            Object.fromEntries(
              Object.entries(a).map(([k, v]) => [k, String(v)]),
            ),
          ]),
        ),
      ),
    );
  } else if (apps.length === 0) {
    console.log('(no apps)');
  } else {
    for (const a of apps) {
      console.log(
        `${a.zone.padEnd(9)} ${a.type.padEnd(7)} ${String(a.port).padEnd(5)} ${a.package.padEnd(36)} ${a.access}${a.kind === 'external' ? ', external' : ''}`,
      );
    }
  }
}

try {
  main();
} catch (error) {
  console.error(`apps: ${/** @type {Error} */ (error).message}`);
  process.exitCode = 1;
}
