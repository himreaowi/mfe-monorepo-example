// @ts-check
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { rspack } from '@rspack/core';
import {
  createRemoteConfig,
  createShellConfig,
  createSharedConfig,
  TIER1_SINGLETONS,
} from './index.js';

/** @typedef {import('@rspack/core').Configuration} Configuration */

const pkgDir = join(import.meta.dirname, '..');
const fixture = join(pkgDir, 'test', 'fixture');

/**
 * @param {Configuration} config
 * @param {string} name
 * @returns {any}
 */
function pluginNamed(config, name) {
  return (config.plugins ?? []).find(
    (p) => /** @type {any} */ (p)?.constructor?.name === name,
  );
}

/** @param {Configuration} config */
const mfOptions = (config) =>
  pluginNamed(config, 'ModuleFederationPlugin')._options;

/** @param {string} name */
const version = (name) =>
  JSON.parse(
    readFileSync(
      join(pkgDir, 'node_modules', ...name.split('/'), 'package.json'),
      'utf8',
    ),
  ).version;

describe('createSharedConfig', () => {
  it('shares every tier-1 package as a strict singleton pinned to the installed version', () => {
    const shared = createSharedConfig(pkgDir);
    assert.deepEqual(Object.keys(shared).sort(), [...TIER1_SINGLETONS].sort());
    for (const pkg of TIER1_SINGLETONS) {
      assert.deepEqual(shared[pkg], {
        singleton: true,
        strictVersion: true,
        requiredVersion: version(pkg),
        version: version(pkg),
      });
    }
    assert.match(shared.react.version ?? '', /^\d+\.\d+\.\d+$/);
  });

  it('skips (and warns about) tier-1 packages the app does not depend on', () => {
    /** @type {string[]} */
    const warnings = [];
    const none = createSharedConfig('/', { warn: (m) => warnings.push(m) });
    assert.deepEqual(none, {});
    assert.ok(warnings.some((w) => w.includes('"react"')));
  });
});

describe('createShellConfig', () => {
  const config = createShellConfig({
    rootDir: fixture,
    name: 'test_shell',
    port: 3100,
  })({ RSPACK_SERVE: true }, {});

  it('is a development config when served', () => {
    assert.equal(config.mode, 'development');
    assert.equal(config.lazyCompilation, false);
    const devServer = /** @type {any} */ (config.devServer);
    assert.equal(devServer.port, 3100);
    assert.deepEqual(devServer.headers, { 'Access-Control-Allow-Origin': '*' });
    assert.equal(typeof devServer.setupMiddlewares, 'function');
  });

  it("uses publicPath '/' and registers remotes only at runtime", () => {
    assert.equal(config.output?.publicPath, '/');
    assert.equal(config.output?.uniqueName, 'test_shell');
    const mf = mfOptions(config);
    assert.equal(mf.name, 'test_shell');
    assert.deepEqual(mf.remotes, {});
    assert.deepEqual(mf.exposes, {});
    assert.equal(mf.shared.react.singleton, true);
    assert.equal(mf.shared.react.strictVersion, true);
    assert.equal(mf.dts, false);
  });

  it("only injects the 'main' chunk into the HTML", () => {
    const html = pluginNamed(config, 'HtmlRspackPlugin');
    assert.deepEqual(html._args[0].chunks, ['main']);
    assert.equal(html._args[0].publicPath, '/');
  });

  it('adds the Workbox plugin to production builds only', () => {
    const prod = createShellConfig({
      rootDir: fixture,
      name: 'test_shell',
      port: 3100,
    })({ RSPACK_BUILD: true }, {});
    assert.equal(prod.mode, 'production');
    assert.ok(pluginNamed(prod, 'PwaPlugin'));
    assert.equal(pluginNamed(config, 'PwaPlugin'), undefined);
  });

  it('rejects invalid federation names', () => {
    assert.throws(
      () =>
        createShellConfig({ rootDir: fixture, name: 'my-shell', port: 3100 })(),
      /Invalid federation name "my-shell"/,
    );
  });
});

describe('createRemoteConfig', () => {
  it("uses publicPath 'auto', exposes ./App by default, no PWA", () => {
    const config = createRemoteConfig({
      rootDir: fixture,
      name: 'test_remote',
      port: 3101,
    })({ RSPACK_BUILD: true }, {});
    assert.equal(config.output?.publicPath, 'auto');
    assert.deepEqual(mfOptions(config).exposes, {
      './App': './src/app/RemoteApp.tsx',
    });
    assert.equal(pluginNamed(config, 'PwaPlugin'), undefined);
  });
});

describe('real build', () => {
  /** @param {string} name */
  async function build(name) {
    const config = createRemoteConfig({
      rootDir: fixture,
      name,
      port: 3101,
      exposes: { './App': './src/App.tsx' },
    })({ RSPACK_BUILD: true }, {});
    const outDir = join(fixture, 'dist', name);
    config.output = { ...config.output, path: outDir };
    config.devtool = false;
    config.optimization = { minimize: false };
    await new Promise((resolve, reject) => {
      rspack(config).run((err, stats) => {
        if (err) return reject(err);
        if (stats?.hasErrors())
          return reject(new Error(stats.toString('errors-only')));
        resolve(undefined);
      });
    });
    const files = readdirSync(outDir);
    const js = files
      .filter((f) => f.endsWith('.js'))
      .map((f) => readFileSync(join(outDir, f), 'utf8'))
      .join('\n');
    const html = readFileSync(join(outDir, 'index.html'), 'utf8');
    return { js, files, html };
  }

  after(
    () =>
      process.env.KEEP_DIST ||
      rmSync(join(fixture, 'dist'), { recursive: true, force: true }),
  );

  it('compiles TSX + SCSS modules, emits mf-manifest.json, salts class names per app', async () => {
    const a = await build('app_a');
    const b = await build('app_b');
    for (const f of ['mf-manifest.json', 'remoteEntry.js', 'index.html']) {
      assert.ok(a.files.includes(f), `${f} emitted`);
    }
    /** @param {string} js */
    const classOf = (js) => js.match(/"widget":\s*["`]([^"`]+)["`]/)?.[1];
    assert.ok(classOf(a.js), 'class name exported');
    assert.ok(classOf(b.js), 'class name exported');
    assert.notEqual(classOf(a.js), classOf(b.js));
    assert.match(a.js, /padding:\s?4px/, 'SCSS compiled');
    // absolute script URL: a standalone deep link (/details) still loads the entry
    assert.match(a.html, /<script[^>]+src="\/main\.[^"]+\.js"/);
  });
});
