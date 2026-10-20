#!/usr/bin/env node
// @ts-check
/**
 * `pnpm -s validate-manifest <file> [--zone=<zone> [--shell=<name>]] [--allow-mock]`: check a
 * per-environment mfe-manifest.json before deploying it (schema, remotes of the shell, no mock auth,
 * https). Exit 1 on errors. See docs/devops-handoff.md.
 */
import path from 'node:path';
import { parseArgs } from 'node:util';
import { validateManifestFile } from '../src/manifest.js';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  args: process.argv.slice(2).filter((a) => a !== '--'),
  options: {
    zone: { type: 'string' },
    shell: { type: 'string' },
    'allow-mock': { type: 'boolean', default: false },
    root: { type: 'string' },
  },
});
if (positionals.length !== 1) {
  console.error(
    'Usage: pnpm -s validate-manifest <mfe-manifest.json> [--zone=<zone> [--shell=<name>]] [--allow-mock]',
  );
  process.exit(2);
}
const root = path.resolve(
  values.root ?? path.join(import.meta.dirname, '..', '..', '..'),
);
const file = path.resolve(
  process.env.INIT_CWD ?? process.cwd(),
  positionals[0],
);
const { errors, warnings } = await validateManifestFile({
  root,
  file,
  zone: values.zone,
  shell: values.shell,
  allowMock: values['allow-mock'],
});
for (const w of warnings) console.warn(`warning [${w.rule}] ${w.message}`);
for (const e of errors) console.error(`error   [${e.rule}] ${e.message}`);
if (errors.length > 0) {
  console.error(
    `✖ ${path.relative(process.cwd(), file)}: ${errors.length} error(s)`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `✔ ${path.relative(process.cwd(), file)}: valid${values.zone ? ` for the ${values.zone} shell` : ''}`,
  );
}
