// @ts-check
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import {
  buildDevManifest,
  devManifestStatus,
  shellDirs,
  writeDevManifest,
} from '../src/dev-manifest.js';
import {
  app,
  cleanupWorkspaces,
  entry,
  makeWorkspace,
  validApps,
} from './fixture.js';

after(cleanupWorkspaces);

const BIN = path.join(import.meta.dirname, '..', 'bin', 'dev-manifest.js');
const vendor = { url: 'http://localhost:3191/mount.js', format: 'esm' };

function workspace() {
  const shell = app('shell', { type: 'shell', port: 3100 });
  return makeWorkspace({
    apps: {
      ...validApps(),
      'intranet/shell-intranet': {
        ...shell,
        mfe: {
          ...shell.mfe,
          devManifest: {
            auth: { mock: true },
            settings: { apiBaseUrl: 'http://localhost:3190/api' },
            remotes: { intranet_leave: { props: { vendor } } },
          },
        },
      },
    },
    files: {
      'apps/intranet/shell-intranet/remotes.json': {
        // registry order is kept; "ghost" has no app (skipped, reported)
        remotes: [
          entry('intranet', 'leave', 'private'),
          entry('intranet', 'ghost'),
          entry('intranet', 'staff'),
        ],
      },
      'apps/internet/shell-internet/remotes.json': { remotes: [] },
    },
  });
}

describe('dev manifest generator', () => {
  it('builds remotes from remotes.json + mfe.port and merges mfe.devManifest', () => {
    const root = workspace();
    const shellDir = path.join(root, 'apps/intranet/shell-intranet');
    const { manifest, problems } = buildDevManifest(root, shellDir);
    assert.deepEqual(manifest, {
      remotes: {
        intranet_leave: {
          entry: 'http://localhost:3102/mf-manifest.json',
          props: { vendor },
        },
        intranet_staff: { entry: 'http://localhost:3101/mf-manifest.json' },
      },
      auth: { mock: true },
      settings: { apiBaseUrl: 'http://localhost:3190/api' },
    });
    assert.deepEqual(Object.keys(manifest.remotes ?? {}), [
      'intranet_leave',
      'intranet_staff',
    ]);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /ghost/);
  });

  it('writes only when the content changes; status follows', () => {
    const root = workspace();
    const shellDir = path.join(root, 'apps/intranet/shell-intranet');
    assert.deepEqual(devManifestStatus(root, shellDir), {
      upToDate: false,
      missing: true,
    });
    assert.equal(writeDevManifest(root, shellDir).changed, true);
    assert.equal(writeDevManifest(root, shellDir).changed, false);
    assert.equal(devManifestStatus(root, shellDir).upToDate, true);
    const file = path.join(shellDir, 'mfe-manifest.dev.json');
    assert.match(fs.readFileSync(file, 'utf8'), /^\{\n {2}"remotes": \{\n/);
  });

  it('CLI: regenerates every shell of the workspace', () => {
    const root = workspace();
    assert.deepEqual(
      shellDirs(root)
        .map((d) => path.relative(root, d))
        .sort(),
      ['apps/internet/shell-internet', 'apps/intranet/shell-intranet'],
    );
    const out = execFileSync(process.execPath, [BIN, '--root', root], {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    assert.match(
      out,
      /wrote apps\/intranet\/shell-intranet\/mfe-manifest\.dev\.json/,
    );
    assert.match(
      out,
      /wrote apps\/internet\/shell-internet\/mfe-manifest\.dev\.json/,
    );
    for (const dir of shellDirs(root)) {
      assert.equal(devManifestStatus(root, dir).upToDate, true);
    }
  });
});
