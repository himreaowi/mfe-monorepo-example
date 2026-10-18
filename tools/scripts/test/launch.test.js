// @ts-check
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { after, describe, it } from 'node:test';

const LAUNCH = pathToFileURL(
  path.resolve(import.meta.dirname, '../src/launch.js'),
).href;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mfe-launch-'));
after(() => fs.rmSync(dir, { recursive: true, force: true }));

/** A fake `nx run-many`: prints, and on SIGTERM prints Nx's misleading summary and exits 1. */
const FAKE_NX = path.join(dir, 'fake-nx.js');
fs.writeFileSync(
  FAKE_NX,
  `const mode = process.argv[2];
console.log('server: ready');
console.error('server: <i> compiled');
if (mode === 'crash') { console.error('server: EADDRINUSE'); process.exit(3); }
process.on('SIGTERM', () => {
  console.error('Tasks not run because their dependencies failed or --nx-bail=true:');
  process.exit(1);
});
setInterval(() => {}, 1000);
`,
);

/**
 * Run a launcher like Playwright's webServer does: own process group, output collected; once
 * it printed "ready", SIGTERM to the whole group (unless the command exits on its own).
 * @param {string} mode
 */
function runLauncher(mode) {
  const script = `import { launch } from ${JSON.stringify(LAUNCH)};
process.exit(await launch({ command: process.execPath, args: [${JSON.stringify(FAKE_NX)}, ${JSON.stringify(mode)}], label: 'dev:test' }));`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', script], {
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  let signalled = false;
  /** @param {Buffer} chunk */
  const collect = (chunk) => {
    output += String(chunk);
    if (mode === 'serve' && !signalled && output.includes('server: ready')) {
      signalled = true;
      setTimeout(
        () => process.kill(-(/** @type {number} */ (child.pid)), 'SIGTERM'),
        200,
      );
    }
  };
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);
  return new Promise((resolve) => {
    child.on('close', (code) => resolve({ code, output }));
  });
}

describe('launch (pnpm dev:<zone>)', () => {
  it('a stop signal ends with one clean line and exit 0, without the Nx failure summary', async () => {
    const { code, output } = /** @type {{ code: number, output: string }} */ (
      await runLauncher('serve')
    );
    assert.equal(code, 0, output);
    assert.match(output, /server: ready/);
    assert.match(
      output,
      /dev:test: dev servers stopped \(SIGTERM, expected\)\./,
    );
    assert.doesNotMatch(output, /Tasks not run/);
  });

  it('a command that fails on its own keeps its output and exit code', async () => {
    const { code, output } = /** @type {{ code: number, output: string }} */ (
      await runLauncher('crash')
    );
    assert.equal(code, 3);
    assert.match(output, /EADDRINUSE/);
    assert.doesNotMatch(output, /stopped/);
  });
});
