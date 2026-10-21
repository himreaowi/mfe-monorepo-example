// @ts-check
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { after, describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { moveRemote, planMove } from '../src/move-remote.js';
import { app, cleanupWorkspaces, makeWorkspace } from './fixture.js';

after(cleanupWorkspaces);

/** A git repo with shells alpha and beta and the remote `services` in alpha's group. */
function repo() {
  const root = makeWorkspace({
    apps: {
      'internet/alpha/shell': app('shell', {
        zone: 'internet',
        type: 'shell',
        port: 3201,
      }),
      'internet/beta/shell': app('shell', {
        zone: 'internet',
        type: 'shell',
        port: 3202,
      }),
      'internet/alpha/services': app('services', {
        zone: 'internet',
        port: 3211,
      }),
    },
    files: {
      'apps/internet/alpha/services/README.md':
        'See apps/internet/alpha/services/src\n',
      'apps/internet/alpha/shell/tsconfig.json':
        '{ "references": [{ "path": "../services" }, { "path": "apps/internet/alpha/services" }] }\n',
      'pnpm-lock.yaml': 'apps/internet/alpha/services:\n',
    },
  });
  const git = (/** @type {string[]} */ ...args) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  git('init', '-q');
  git('add', '-A');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'init');
  return { root, git };
}
const quiet = () => {};

describe('move-remote', () => {
  it('--dry-run prints the plan and changes nothing', () => {
    const { root } = repo();
    /** @type {string[]} */
    const lines = [];
    moveRemote({
      root,
      zone: 'internet',
      remote: 'services',
      to: 'shared',
      dryRun: true,
      log: (l) => lines.push(l),
    });
    assert.match(
      lines.join('\n'),
      /git mv apps\/internet\/alpha\/services apps\/internet\/shared\/services/,
    );
    assert.match(
      lines.join('\n'),
      /rewrite .* in apps\/internet\/shared\/services\/README\.md/,
    );
    assert.ok(
      fs.existsSync(
        path.join(root, 'apps/internet/alpha/services/package.json'),
      ),
    );
  });

  it('moves with git mv (history kept), rewrites path references, not the lockfile', () => {
    const { root, git } = repo();
    const r = moveRemote({
      root,
      zone: 'internet',
      remote: 'services',
      to: 'shared',
      install: false,
      check: false,
      log: quiet,
    });
    assert.ok(!fs.existsSync(path.join(root, 'apps/internet/alpha/services')));
    assert.ok(
      fs.existsSync(
        path.join(root, 'apps/internet/shared/services/package.json'),
      ),
    );
    assert.match(
      git('status', '--short'),
      /R .*apps\/internet\/(alpha|shared)\/services\/package\.json/,
    );
    assert.equal(
      fs.readFileSync(
        path.join(root, 'apps/internet/shared/services/README.md'),
        'utf8',
      ),
      'See apps/internet/shared/services/src\n',
    );
    assert.match(
      fs.readFileSync(
        path.join(root, 'apps/internet/alpha/shell/tsconfig.json'),
        'utf8',
      ),
      /apps\/internet\/shared\/services/,
    );
    assert.equal(
      fs.readFileSync(path.join(root, 'pnpm-lock.yaml'), 'utf8'),
      'apps/internet/alpha/services:\n',
    );
    assert.deepEqual(r.rewritten.sort(), [
      'apps/internet/alpha/shell/tsconfig.json',
      'apps/internet/shared/services/README.md',
    ]);
    // and back into a shell's group
    moveRemote({
      root,
      zone: 'internet',
      remote: 'services',
      to: 'beta',
      install: false,
      check: false,
      log: quiet,
    });
    assert.ok(
      fs.existsSync(
        path.join(root, 'apps/internet/beta/services/package.json'),
      ),
    );
  });

  it('refuses unknown zone, remote or shell, an existing target and a no-op', () => {
    const { root } = repo();
    const plan =
      (
        /** @type {string} */ zone,
        /** @type {string} */ remote,
        /** @type {string} */ to,
      ) =>
      () =>
        planMove({ root, zone, remote, to });
    assert.throws(plan('nowhere', 'services', 'shared'), /Unknown zone/);
    assert.throws(plan('internet', 'ghost', 'shared'), /No remote "ghost"/);
    assert.throws(
      plan('internet', 'services', 'gamma'),
      /no such internet shell/,
    );
    assert.throws(plan('internet', 'services', 'alpha'), /already in/);
    fs.mkdirSync(path.join(root, 'apps/internet/shared/services'), {
      recursive: true,
    });
    assert.throws(plan('internet', 'services', 'shared'), /already exists/);
  });
});
