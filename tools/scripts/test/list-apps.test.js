// @ts-check
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import {
  affectedApps,
  affectedFromFiles,
  changedFiles,
  listApps,
} from '../src/apps.js';
import { app, cleanupWorkspaces, makeWorkspace } from './fixture.js';

after(cleanupWorkspaces);

const BIN = path.join(import.meta.dirname, '..', 'bin', 'list-apps.js');

/** Two zones; staff depends on @org/charts (which depends on @org/ui), leave does not. */
function workspace() {
  const root = makeWorkspace({
    packages: {
      ui: { name: '@org/ui', version: '0.1.0' },
      charts: {
        name: '@org/charts',
        version: '0.1.0',
        dependencies: { '@org/ui': 'workspace:*' },
      },
      unused: { name: '@org/unused', version: '0.1.0' },
    },
    apps: {
      'intranet/intranet/shell': app('shell', { type: 'shell', port: 3101 }),
      'intranet/intranet/staff': app('staff', {
        port: 3111,
        deps: { '@org/charts': 'workspace:*' },
      }),
      'intranet/intranet/leave': app('leave', {
        port: 3112,
        access: 'private',
        tags: ['zone:intranet', 'type:remote', 'access:private'],
      }),
      'intranet/intranet/helpdesk': app('helpdesk', {
        port: 3113,
        tags: [
          'zone:intranet',
          'type:remote',
          'access:public',
          'kind:external',
        ],
      }),
      'internet/internet/shell': app('shell', {
        zone: 'internet',
        type: 'shell',
        port: 3201,
      }),
      'internet/internet/services': app('services', {
        zone: 'internet',
        port: 3211,
      }),
    },
    files: { 'docs/readme.md': '# docs\n' },
  });
  // leave depends on nothing from packages/ except tier-1 @org/ui (from app()); drop it to test
  // that an app without the dependency is not affected
  const leaveFile = path.join(
    root,
    'apps/intranet/intranet/leave/package.json',
  );
  const leave = JSON.parse(fs.readFileSync(leaveFile, 'utf8'));
  delete leave.dependencies['@org/ui'];
  fs.writeFileSync(leaveFile, JSON.stringify(leave, null, 2));
  return root;
}

/** @param {string} root */
function gitInit(root) {
  const git = (/** @type {string[]} */ ...args) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  git('init', '-q');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'test');
  git('add', '-A');
  git('commit', '-qm', 'base');
  return { git, base: git('rev-parse', 'HEAD') };
}

describe('listApps', () => {
  it('lists every app with CI metadata, shells first per zone', () => {
    const root = workspace();
    const apps = listApps({ root });
    assert.deepEqual(
      apps.map((a) => a.package),
      [
        '@org/shell-intranet',
        '@org/intranet-helpdesk',
        '@org/intranet-leave',
        '@org/intranet-staff',
        '@org/shell-internet',
        '@org/internet-services',
      ],
    );
    assert.deepEqual(apps[1], {
      name: 'helpdesk',
      package: '@org/intranet-helpdesk',
      zone: 'intranet',
      type: 'remote',
      access: 'public',
      kind: 'external',
      port: 3113,
      federationName: 'intranet_helpdesk',
      path: 'apps/intranet/intranet/helpdesk',
      distDir: 'apps/intranet/intranet/helpdesk/dist',
    });
    assert.equal(apps[2].access, 'private');
    assert.equal(apps[0].type, 'shell');
  });

  it('filters by zone; empty apps/ gives []', () => {
    const root = workspace();
    assert.deepEqual(
      listApps({ root, zone: 'internet' }).map((a) => a.name),
      ['shell-internet', 'services'],
    );
    assert.deepEqual(listApps({ root: makeWorkspace() }), []);
  });
});

describe('affectedFromFiles (git fallback)', () => {
  it('a file in one remote affects only that remote', () => {
    const root = workspace();
    const set = affectedFromFiles({
      root,
      files: ['apps/intranet/intranet/staff/src/App.tsx'],
    });
    assert.deepEqual([...(set ?? [])], ['@org/intranet-staff']);
  });

  it('a shared package affects every (transitive) dependent', () => {
    const root = workspace();
    const set = affectedFromFiles({
      root,
      files: ['packages/platform/ui/src/Button.tsx'],
    });
    assert.deepEqual([...(set ?? [])].sort(), [
      '@org/charts',
      '@org/internet-services',
      '@org/intranet-helpdesk',
      '@org/intranet-staff',
      '@org/shell-internet',
      '@org/shell-intranet',
      '@org/ui',
    ]);
  });

  it('global files (lockfile, deploy/) affect everything; docs nothing', () => {
    const root = workspace();
    assert.equal(affectedFromFiles({ root, files: ['pnpm-lock.yaml'] }), null);
    assert.equal(
      affectedFromFiles({
        root,
        files: ['deploy/nginx/default.conf.template'],
      }),
      null,
    );
    assert.deepEqual(
      [...(affectedFromFiles({ root, files: ['docs/readme.md'] }) ?? [])],
      [],
    );
    assert.deepEqual(
      [...(affectedFromFiles({ root, files: ['deploy/README.md'] }) ?? [])],
      [],
    );
  });
});

describe('affectedApps', () => {
  it('uses git when Nx is not installed: remote change, package change, zone filter', () => {
    const root = workspace();
    const { base } = gitInit(root);
    assert.deepEqual(changedFiles({ root, base }), []);
    assert.deepEqual(affectedApps({ root, base }).apps, []);

    fs.appendFileSync(
      path.join(root, 'apps/intranet/intranet/staff/package.json'),
      '\n',
    );
    let result = affectedApps({ root, base });
    assert.equal(result.source, 'git');
    assert.deepEqual(
      result.apps.map((a) => a.name),
      ['staff'],
    );

    fs.mkdirSync(path.join(root, 'packages/platform/charts/src'));
    fs.writeFileSync(
      path.join(root, 'packages/platform/charts/src/new.ts'),
      '',
    );
    result = affectedApps({ root, base, zone: 'intranet' });
    assert.deepEqual(
      result.apps.map((a) => a.name),
      ['staff'],
    );
  });

  it('compares base...head when head is given; deploy/ affects every app', () => {
    const root = workspace();
    const { git, base } = gitInit(root);
    fs.mkdirSync(path.join(root, 'deploy'));
    fs.writeFileSync(path.join(root, 'deploy/Dockerfile'), 'FROM nginx\n');
    git('add', '-A');
    git('commit', '-qm', 'deploy');
    const head = git('rev-parse', 'HEAD');
    assert.deepEqual(changedFiles({ root, base, head }), ['deploy/Dockerfile']);
    assert.equal(affectedApps({ root, base, head }).apps.length, 6);
  });
});

describe('CLI', () => {
  /** @param {string[]} args */
  const run = (...args) =>
    execFileSync(process.execPath, [BIN, ...args], { encoding: 'utf8' });

  it('--json, --zone, --matrix', () => {
    const root = workspace();
    const all = JSON.parse(run(`--root=${root}`, '--json'));
    assert.equal(all.length, 6);
    const internet = JSON.parse(
      run(`--root=${root}`, '--zone=internet', '--json'),
    );
    assert.deepEqual(
      internet.map((/** @type {{ name: string }} */ a) => a.name),
      ['shell-internet', 'services'],
    );
    const matrix = JSON.parse(
      run(`--root=${root}`, '--zone=internet', '--matrix'),
    );
    assert.deepEqual(Object.keys(matrix), [
      'internet_shell',
      'internet_services',
    ]);
    assert.equal(matrix.internet_services.port, '3211');
  });

  it('--affected needs a base; unknown zones fail', () => {
    const root = workspace();
    assert.throws(
      () =>
        execFileSync(process.execPath, [BIN, `--root=${root}`, '--affected'], {
          encoding: 'utf8',
          stdio: 'pipe',
          env: { ...process.env, NX_BASE: '' },
        }),
      /--affected needs --base/,
    );
    assert.throws(
      () =>
        execFileSync(process.execPath, [BIN, `--root=${root}`, '--zone=moon'], {
          encoding: 'utf8',
          stdio: 'pipe',
        }),
      /unknown zone "moon"/,
    );
  });

  it('--affected --json after a change in one remote', () => {
    const root = workspace();
    const { base } = gitInit(root);
    fs.appendFileSync(
      path.join(root, 'apps/internet/internet/services/package.json'),
      '\n',
    );
    const out = JSON.parse(
      run(`--root=${root}`, '--affected', `--base=${base}`, '--json'),
    );
    assert.deepEqual(
      out.map((/** @type {{ package: string }} */ a) => a.package),
      ['@org/internet-services'],
    );
  });
});
