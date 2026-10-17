// @ts-check
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { checkApps, checkVersions } from '@org/scripts';
import { generateRemote, generateShell } from '../src/index.js';

const REPO = path.resolve(import.meta.dirname, '..', '..', '..');
const BIN = path.join(REPO, 'tools', 'generators', 'bin', 'gen.js');

/** @type {string[]} */
const created = [];
after(() => {
  for (const dir of created) fs.rmSync(dir, { recursive: true, force: true });
});

/**
 * Temp workspace that looks like the template for the checks: the real pnpm-workspace.yaml and
 * version-exceptions.json, the root package.json, every package/tool package.json and the
 * tier-1 list. Empty apps/.
 */
function tempWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mfe-gen-'));
  created.push(root);
  const copy = (/** @type {string} */ rel) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.copyFileSync(path.join(REPO, rel), path.join(root, rel));
  };
  for (const rel of [
    'pnpm-workspace.yaml',
    'version-exceptions.json',
    'package.json',
    'packages/rspack-config/src/tier1.js',
  ]) {
    copy(rel);
  }
  for (const group of ['packages', 'tools']) {
    for (const d of fs.readdirSync(path.join(REPO, group))) {
      if (fs.existsSync(path.join(REPO, group, d, 'package.json'))) {
        copy(`${group}/${d}/package.json`);
      }
    }
  }
  fs.mkdirSync(path.join(root, 'apps'));
  return root;
}

const read = (/** @type {string} */ root, /** @type {string} */ rel) =>
  fs.readFileSync(path.join(root, rel), 'utf8');
const readJson = (/** @type {string} */ root, /** @type {string} */ rel) =>
  JSON.parse(read(root, rel));

/** All files below dir (relative), without node_modules. */
function listFiles(/** @type {string} */ dir) {
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => path.relative(dir, path.join(d.parentPath, d.name)))
    .sort();
}

describe('generators', () => {
  /** @type {string} */
  let root;

  before(async () => {
    root = tempWorkspace();
  });

  it('refuses gen:remote before the shell exists', async () => {
    await assert.rejects(
      generateRemote({ root, zone: 'intranet', name: 'staff-directory' }),
      /Run "pnpm gen:shell intranet" first/,
    );
  });

  it('generates the intranet shell', async () => {
    const r = await generateShell({ root, zone: 'intranet' });
    assert.equal(r.port, 3100);
    assert.equal(r.federationName, 'intranet_shell');
    const dir = 'apps/intranet/shell-intranet';
    const pkg = readJson(root, `${dir}/package.json`);
    assert.equal(pkg.name, '@org/shell-intranet');
    assert.deepEqual(pkg.nx.tags, [
      'zone:intranet',
      'type:shell',
      'access:public',
    ]);
    assert.deepEqual(pkg.mfe, { port: 3100, federationName: 'intranet_shell' });
    assert.deepEqual(Object.keys(pkg.scripts), [
      'dev',
      'build',
      'preview',
      'lint',
      'typecheck',
      'test',
    ]);
    assert.equal(pkg.dependencies['@org/pwa'], 'workspace:*');
    for (const [dep, spec] of Object.entries({
      ...pkg.dependencies,
      ...pkg.devDependencies,
    })) {
      assert.equal(
        spec,
        dep.startsWith('@org/') ? 'workspace:*' : 'catalog:',
        dep,
      );
    }
    assert.deepEqual(readJson(root, `${dir}/remotes.json`).remotes, []);
    assert.deepEqual(readJson(root, `${dir}/mfe-manifest.dev.json`), {
      remotes: {},
      settings: {},
    });
    const files = listFiles(path.join(root, dir));
    for (const f of [
      'README.md',
      'eslint.config.js',
      'jest.config.js',
      'rspack.config.js',
      'tsconfig.json',
      'public/index.html',
      'src/main.tsx',
      'src/bootstrap.tsx',
      'src/app/App.tsx',
      'src/app/routes.tsx',
      'src/components/RemoteNav/RemoteNav.tsx',
      'src/features/welcome/Welcome.tsx',
      'src/features/startup/StartupError.tsx',
      'src/layouts/ShellLayout/ShellLayout.tsx',
      'src/pages/HomePage/HomePage.tsx',
      'src/pages/RemotePage/RemotePage.tsx',
      'src/core/constants/routePaths.ts',
      'src/services/http.ts',
    ]) {
      assert.ok(files.includes(f), `missing ${f}`);
    }
    assert.match(read(root, `${dir}/rspack.config.js`), /createShellConfig/);
    assert.match(read(root, `${dir}/src/bootstrap.tsx`), /registerPwa\(\)/);
    assert.match(read(root, `${dir}/src/bootstrap.tsx`), /loadMfeManifest/);
  });

  it('refuses to generate the same shell twice', async () => {
    await assert.rejects(
      generateShell({ root, zone: 'intranet' }),
      /already exists\. Generators never overwrite/,
    );
  });

  it('generates remotes with ports, tags and shell registration', async () => {
    const a = await generateRemote({
      root,
      zone: 'intranet',
      name: 'staff-directory',
    });
    const b = await generateRemote({
      root,
      zone: 'intranet',
      name: 'leave-requests',
      private: true,
    });
    assert.equal(a.port, 3101);
    assert.equal(b.port, 3102);
    assert.equal(a.federationName, 'intranet_staff_directory');
    const pkgA = readJson(root, 'apps/intranet/staff-directory/package.json');
    const pkgB = readJson(root, 'apps/intranet/leave-requests/package.json');
    assert.equal(pkgA.name, '@org/intranet-staff-directory');
    assert.deepEqual(pkgA.nx.tags, [
      'zone:intranet',
      'type:remote',
      'access:public',
    ]);
    assert.deepEqual(pkgB.nx.tags, [
      'zone:intranet',
      'type:remote',
      'access:private',
    ]);
    assert.equal(pkgA.dependencies['@org/pwa'], undefined);

    const shell = 'apps/intranet/shell-intranet';
    assert.deepEqual(readJson(root, `${shell}/remotes.json`).remotes, [
      {
        name: 'staff-directory',
        title: 'Staff Directory',
        path: '/staff-directory',
        federationName: 'intranet_staff_directory',
        package: '@org/intranet-staff-directory',
        access: 'public',
        kind: 'react',
      },
      {
        name: 'leave-requests',
        title: 'Leave Requests',
        path: '/leave-requests',
        federationName: 'intranet_leave_requests',
        package: '@org/intranet-leave-requests',
        access: 'private',
        kind: 'react',
      },
    ]);
    assert.deepEqual(readJson(root, `${shell}/mfe-manifest.dev.json`).remotes, {
      intranet_staff_directory: {
        entry: 'http://localhost:3101/mf-manifest.json',
      },
      intranet_leave_requests: {
        entry: 'http://localhost:3102/mf-manifest.json',
      },
    });
  });

  it('remote layout: exposed module never imports global styles', () => {
    const dir = 'apps/intranet/staff-directory';
    const files = listFiles(path.join(root, dir));
    for (const f of [
      'src/app/RemoteApp.tsx',
      'src/app/apps.tsx',
      'src/app/routes.tsx',
      'src/app/standaloneProps.ts',
      'src/components/ModeBadge/ModeBadge.tsx',
      'src/features/demo/Demo.tsx',
      'src/features/demo/Demo.test.tsx',
      'src/layouts/StandaloneLayout/StandaloneLayout.tsx',
      'src/pages/OverviewPage/OverviewPage.tsx',
      'src/pages/DetailsPage/DetailsPage.tsx',
      'src/core/constants/apiRoutes.ts',
      'src/services/http.ts',
      'public/index.html',
    ]) {
      assert.ok(files.includes(f), `missing ${f}`);
    }
    assert.match(read(root, `${dir}/rspack.config.js`), /createRemoteConfig/);
    for (const f of ['src/app/RemoteApp.tsx', 'src/app/apps.tsx']) {
      assert.doesNotMatch(read(root, `${dir}/${f}`), /global\.scss/);
    }
    assert.match(read(root, `${dir}/src/bootstrap.tsx`), /global\.scss/);
    assert.match(
      read(root, `${dir}/src/app/RemoteApp.tsx`),
      /EmbeddedApp as default/,
    );
  });

  it('substitutes every template token', () => {
    for (const app of ['shell-intranet', 'staff-directory', 'leave-requests']) {
      const dir = path.join(root, 'apps', 'intranet', app);
      for (const f of listFiles(dir)) {
        assert.doesNotMatch(
          fs.readFileSync(path.join(dir, f), 'utf8'),
          /__[A-Z][A-Z0-9_]*__/,
          `${app}/${f}`,
        );
        assert.ok(!f.endsWith('.tmpl'), f);
      }
    }
  });

  it('generates the internet zone and an external adapter remote', async () => {
    const s = await generateShell({ root, zone: 'internet' });
    assert.equal(s.port, 3200);
    const r = await generateRemote({
      root,
      zone: 'internet',
      name: 'services',
    });
    assert.equal(r.port, 3201);
    const x = await generateRemote({
      root,
      zone: 'internet',
      name: 'payments',
      external: true,
    });
    assert.equal(x.port, 3202);
    assert.equal(x.entry.kind, 'external');
    const pkg = readJson(root, 'apps/internet/payments/package.json');
    assert.deepEqual(pkg.nx.tags, [
      'zone:internet',
      'type:remote',
      'access:public',
      'kind:external',
    ]);
    assert.match(
      read(
        root,
        'apps/internet/payments/src/features/external/ExternalModuleHost.tsx',
      ),
      /TODO A7/,
    );
    assert.match(
      read(
        root,
        'apps/internet/payments/src/pages/OverviewPage/OverviewPage.tsx',
      ),
      /ExternalModuleHost/,
    );
  });

  it('reuses the lowest free port', async () => {
    fs.rmSync(path.join(root, 'apps/internet/services'), { recursive: true });
    const shell = path.join(root, 'apps/internet/shell-internet/remotes.json');
    const reg = JSON.parse(fs.readFileSync(shell, 'utf8'));
    reg.remotes = reg.remotes.filter(
      (/** @type {any} */ e) => e.name !== 'services',
    );
    fs.writeFileSync(shell, JSON.stringify(reg));
    const r = await generateRemote({
      root,
      zone: 'internet',
      name: 'announcements',
    });
    assert.equal(r.port, 3201);
  });

  it('refuses existing names, stale registry entries and bad input', async () => {
    await assert.rejects(
      generateRemote({ root, zone: 'intranet', name: 'staff-directory' }),
      /already exists/,
    );
    // registry entry left behind without the folder
    const registryFile = path.join(
      root,
      'apps/internet/shell-internet/remotes.json',
    );
    const original = fs.readFileSync(registryFile, 'utf8');
    const reg = JSON.parse(original);
    reg.remotes.push({
      ...reg.remotes[0],
      name: 'ghost',
      path: '/ghost',
      federationName: 'internet_ghost',
    });
    fs.writeFileSync(registryFile, JSON.stringify(reg));
    await assert.rejects(
      generateRemote({ root, zone: 'internet', name: 'ghost' }),
      /already registered/,
    );
    assert.ok(!fs.existsSync(path.join(root, 'apps/internet/ghost')));
    fs.writeFileSync(registryFile, original);
    for (const name of [
      'Bad',
      'a',
      '-x',
      'x--y',
      'x_y',
      'shell',
      'shell-two',
      '9lives',
    ]) {
      await assert.rejects(
        generateRemote({ root, zone: 'intranet', name }),
        /Invalid remote name/,
        name,
      );
    }
    await assert.rejects(
      generateShell({ root, zone: 'extranet' }),
      /Unknown zone/,
    );
  });

  it('the generated workspace passes check-apps and check-versions', async () => {
    const apps = await checkApps({ root });
    assert.deepEqual(apps.errors, []);
    assert.deepEqual(apps.warnings, []);
    const versions = await checkVersions({ root });
    assert.deepEqual(versions.errors, []);
  });

  it('CLI: generates and reports errors without a stack trace', () => {
    const cliRoot = tempWorkspace();
    const out = execFileSync(
      process.execPath,
      [BIN, 'shell', 'internet', '--root', cliRoot],
      {
        encoding: 'utf8',
      },
    );
    assert.match(out, /Created apps\/internet\/shell-internet .*port 3200/);
    const remote = execFileSync(
      process.execPath,
      [BIN, 'remote', 'internet', 'my-profile', '--private', '--root', cliRoot],
      { encoding: 'utf8' },
    );
    assert.match(remote, /port 3201, private/);
    assert.match(remote, /route \/my-profile\/\*/);
    let stderr = '';
    try {
      execFileSync(
        process.execPath,
        [BIN, 'remote', 'intranet', 'x1', '--root', cliRoot],
        {
          encoding: 'utf8',
          stdio: 'pipe',
        },
      );
      assert.fail('should exit non-zero');
    } catch (e) {
      stderr = /** @type {any} */ (e).stderr;
      assert.equal(/** @type {any} */ (e).status, 1);
    }
    assert.match(stderr, /^error: The intranet shell does not exist yet/);
    assert.doesNotMatch(stderr, /at .*\.js:\d+/);
  });
});
