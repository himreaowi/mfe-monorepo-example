#!/usr/bin/env node
// @ts-check
/**
 * `pnpm storybook`: Storybook dev server on the port from root package.json
 * `mfe.tools.storybook` (3192 in the template). `--exact-port`: fails instead of picking
 * another port when it is taken. Extra arguments are passed to `storybook dev`.
 */
import { spawn } from 'node:child_process';
import { toolPort } from './tool-port.js';

const port = toolPort('storybook');
const child = spawn(
  'storybook',
  [
    'dev',
    '--port',
    String(port),
    '--exact-port',
    '--no-open',
    ...process.argv.slice(2),
  ],
  { stdio: 'inherit', shell: process.platform === 'win32' },
);
for (const signal of /** @type {const} */ (['SIGINT', 'SIGTERM'])) {
  process.on(signal, () => child.kill(signal));
}
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
