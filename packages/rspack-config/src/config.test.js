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
  devContentSecurityPolicy,
  getLocalIdent,
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

/**
 * Loader of each SCSS/CSS rule (first entry of `use`: the CSS extract loader).
 * @param {Configuration} config
 * @returns {string[]}
 */
const styleRuleFirstLoaders = (config) =>
  (config.module?.rules ?? [])
    .map((r) => /** @type {any} */ (r))
    .filter((r) => String(r.test).includes('css'))
    .map((r) => r.use[0].loader);

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
    assert.equal(devServer.headers['Access-Control-Allow-Origin'], '*');
    assert.equal(typeof devServer.setupMiddlewares, 'function');
    // missing .json/.js files stay 404 (HMR falls back to a reload after a failed build)
    assert.deepEqual(devServer.historyApiFallback.htmlAcceptHeaders, [
      'text/html',
    ]);
  });

  it('dev server sends the production CSP rules with localhost origins', () => {
    const devServer = /** @type {any} */ (config.devServer);
    const csp = devServer.headers['Content-Security-Policy'];
    assert.equal(csp, devContentSecurityPolicy());
    assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
    assert.match(
      csp,
      /style-src 'self' http:\/\/localhost:\* http:\/\/127\.0\.0\.1:\*;/,
    );
    assert.match(csp, /script-src 'self' http:\/\/localhost:\* /);
    assert.match(csp, /connect-src [^;]*ws:\/\/localhost:\*/, 'HMR websockets');
    assert.match(csp, /frame-src 'none'/);
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /frame-ancestors 'none'/);
  });

  it('devCsp: extra origins / frames, or off', () => {
    const csp = (/** @type {any} */ devCsp) =>
      /** @type {any} */ (
        createShellConfig({
          rootDir: fixture,
          name: 'test_shell',
          port: 3100,
          devCsp,
        })({ RSPACK_SERVE: true }, {}).devServer
      ).headers['Content-Security-Policy'];
    const extra = csp({
      extraOrigins: ['https://dev.example.sg'],
      frameSrc: ['https://vendor.example.com'],
    });
    assert.match(extra, /style-src 'self' [^;]*https:\/\/dev\.example\.sg;/);
    assert.match(extra, /connect-src 'self' [^;]*https:\/\/dev\.example\.sg /);
    assert.match(extra, /frame-src https:\/\/vendor\.example\.com;/);
    assert.equal(csp(false), undefined);
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
    // shared singletons are negotiated before the entry runs: no import('./bootstrap') file
    assert.deepEqual(mf.experiments, { asyncStartup: true });
  });

  it('basePath: assets, index.html, manifest, history fallback, HMR socket below it', () => {
    const sub = createShellConfig({
      rootDir: fixture,
      name: 'test_shell',
      port: 3201,
      basePath: '/citizen/',
    })({ RSPACK_SERVE: true }, {});
    const devServer = /** @type {any} */ (sub.devServer);
    assert.equal(sub.output?.publicPath, '/citizen/');
    assert.equal(devServer.historyApiFallback.index, '/citizen/index.html');
    assert.equal(devServer.client.webSocketURL.pathname, '/citizen/ws');
    assert.equal(devServer.webSocketServer.options.path, '/citizen/ws');
    const define = pluginNamed(sub, 'DefinePlugin');
    assert.equal(define._args[0].__MFE_BASE_PATH__, '"/citizen"');
    const html = pluginNamed(sub, 'HtmlRspackPlugin');
    const htmlOptions = html._args[0];
    assert.equal(htmlOptions.publicPath, '/citizen/');
    assert.match(
      htmlOptions.templateParameters.manifestLink,
      /href="\/citizen\/manifest\.webmanifest"/,
    );
    const middlewares = devServer.setupMiddlewares([], {});
    assert.deepEqual(
      middlewares.map((/** @type {any} */ m) => m.name),
      ['mfe-base-path-redirect', 'mfe-dev-manifest'],
    );
    assert.equal(middlewares[1].path, '/citizen/mfe-manifest.json');
    // the default stays at the origin root
    assert.equal(
      /** @type {any} */ (config.devServer).historyApiFallback.index,
      '/index.html',
    );
    assert.equal(
      /** @type {any} */ (config.devServer).webSocketServer,
      undefined,
    );
    assert.throws(
      () =>
        createShellConfig({
          rootDir: fixture,
          name: 'test_shell',
          port: 3201,
          basePath: 'citizen',
        })({ RSPACK_SERVE: true }, {}),
      /Invalid basePath/,
    );
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

  it('development: extracts CSS like production (unhashed [name].css), no style-loader', () => {
    const loaders = styleRuleFirstLoaders(config);
    assert.equal(loaders.length, 2);
    for (const loader of loaders) {
      assert.equal(loader, rspack.CssExtractRspackPlugin.loader);
      assert.doesNotMatch(loader, /style-loader/);
    }
    const extract = pluginNamed(config, 'CssExtractRspackPlugin');
    assert.ok(extract, 'CssExtractRspackPlugin in development');
    assert.equal(extract.options.filename, '[name].css');
    assert.equal(extract.options.chunkFilename, '[name].css');
  });

  it('CSS Modules: the same class name pattern and salt in development and production', () => {
    const prod = createShellConfig({
      rootDir: fixture,
      name: 'test_shell',
      port: 3100,
    })({ RSPACK_BUILD: true }, {});
    /** @param {Configuration} c */
    const modulesOptions = (c) =>
      (c.module?.rules ?? [])
        .map((r) => /** @type {any} */ (r))
        .find((r) => String(r.test).includes('module')).use[1].options.modules;
    assert.deepEqual(modulesOptions(config), modulesOptions(prod));
    assert.equal(
      modulesOptions(config).localIdentName,
      '[name]_[local]__[hash:base64:5]',
    );
    assert.equal(modulesOptions(config).getLocalIdent, getLocalIdent);
    assert.equal(modulesOptions(config).localIdentHashSalt, 'test_shell');
  });

  it('production: extracts CSS into [name].[contenthash:8].css files, no style-loader', () => {
    const prod = createShellConfig({
      rootDir: fixture,
      name: 'test_shell',
      port: 3100,
    })({ RSPACK_BUILD: true }, {});
    const loaders = styleRuleFirstLoaders(prod);
    assert.equal(loaders.length, 2);
    for (const loader of loaders) {
      assert.equal(loader, rspack.CssExtractRspackPlugin.loader);
      assert.doesNotMatch(loader, /style-loader/);
    }
    const extract = pluginNamed(prod, 'CssExtractRspackPlugin');
    assert.ok(extract, 'CssExtractRspackPlugin in production');
    assert.equal(extract.options.filename, '[name].[contenthash:8].css');
    assert.equal(extract.options.chunkFilename, '[name].[contenthash:8].css');
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
      './App': './src/app/apps.tsx',
    });
    assert.equal(pluginNamed(config, 'PwaPlugin'), undefined);
    assert.ok(pluginNamed(config, 'CssExtractRspackPlugin'));
  });
});

/** deploy/nginx/default.conf.template: content-hashed files cached as immutable */
const NGINX_IMMUTABLE = /\.[0-9a-f]{8}\.(?:js|mjs|css)$/;

describe('real build', () => {
  /**
   * @param {string} name
   * @param {{ production?: boolean, development?: boolean, outName?: string }} [opts]
   *   production: keep the default devtool + minifier; development: a `rspack dev` config
   *   (compiled without the dev server)
   */
  async function build(name, opts = {}) {
    const config = createRemoteConfig({
      rootDir: fixture,
      name,
      port: 3101,
      exposes: { './App': './src/App.tsx' },
    })(opts.development ? { RSPACK_SERVE: true } : { RSPACK_BUILD: true }, {});
    const outDir = join(fixture, 'dist', opts.outName ?? name);
    config.output = { ...config.output, path: outDir };
    if (!opts.production && !opts.development) {
      config.devtool = false;
      config.optimization = { minimize: false };
    }
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
    const cssFiles = files.filter((f) => f.endsWith('.css'));
    const css = cssFiles
      .map((f) => readFileSync(join(outDir, f), 'utf8'))
      .join('\n');
    const html = readFileSync(join(outDir, 'index.html'), 'utf8');
    const maps = files
      .filter((f) => f.endsWith('.map'))
      .map((f) => readFileSync(join(outDir, f), 'utf8'));
    const manifest = JSON.parse(
      readFileSync(join(outDir, 'mf-manifest.json'), 'utf8'),
    );
    const read = (/** @type {string} */ f) =>
      readFileSync(join(outDir, f), 'utf8');
    return { js, css, cssFiles, files, html, maps, manifest, read };
  }

  after(
    () =>
      process.env.KEEP_DIST ||
      rmSync(join(fixture, 'dist'), { recursive: true, force: true }),
  );

  it('compiles TSX + SCSS modules, emits mf-manifest.json, readable class names salted per app', async () => {
    const a = await build('app_a');
    const b = await build('app_b');
    for (const f of ['mf-manifest.json', 'remoteEntry.js', 'index.html']) {
      assert.ok(a.files.includes(f), `${f} emitted`);
    }
    /** @param {string} js */
    const classOf = (js) => js.match(/"widget":\s*["`]([^"`]+)["`]/)?.[1];
    // `Widget.module.scss` `.widget` → `Widget_widget__<5-char hash>` (no `.module` in it)
    assert.match(classOf(a.js) ?? '', /^Widget_widget__[A-Za-z0-9_-]{5}$/);
    assert.match(classOf(b.js) ?? '', /^Widget_widget__[A-Za-z0-9_-]{5}$/);
    // same file and class, another federation name: another hash
    assert.notEqual(classOf(a.js), classOf(b.js));
    // production: the CSS is in .css files, not in the JS (no style-loader runtime)
    assert.match(a.css, /padding:\s?4px/, 'SCSS compiled into a .css file');
    assert.ok(a.css.includes(`.${classOf(a.js)}`), 'salted class in the CSS');
    assert.doesNotMatch(a.js, /padding:\s?4px/, 'no CSS inside the JS');
    assert.doesNotMatch(a.js, /insertStyleElement|styleTagTransform/);
    // absolute script URL: a standalone deep link (/details) still loads the entry
    assert.match(a.html, /<script[^>]+src="\/main\.[^"]+\.js"/);
  });

  it('production: content-hashed .css per chunk (exposed module + lazy chunk), loaded by the chunk loader', async () => {
    const prod = await build('app_css', { production: true });
    assert.ok(prod.cssFiles.length >= 2, `css files: ${prod.cssFiles}`);
    for (const f of prod.cssFiles) {
      assert.match(f, NGINX_IMMUTABLE, `${f} matches the nginx immutable rule`);
      assert.doesNotMatch(prod.read(f), /sourceMappingURL/, 'no CSS map ref');
    }
    assert.ok(
      !prod.files.some((f) => f.endsWith('.css.map')),
      'no CSS source maps',
    );
    const expose = prod.manifest.exposes.find(
      (/** @type {{ name: string }} */ e) => e.name === 'App',
    );
    assert.equal(expose.assets.css.sync.length, 1, 'exposed module CSS');
    assert.match(expose.assets.css.sync[0], NGINX_IMMUTABLE);
    assert.ok(expose.assets.css.async.length >= 1, 'lazy chunk CSS');
    assert.match(prod.css, /margin:3px/, 'lazy chunk CSS emitted');
    // remoteEntry.js carries the CSS chunk loader (<link rel="stylesheet">, rejects on error)
    const remoteEntry = prod.read('remoteEntry.js');
    assert.match(remoteEntry, /CSS_CHUNK_LOAD_FAILED/);
    assert.match(remoteEntry, /stylesheet/);
  });

  it('development: unhashed .css per chunk with linked .css.map, no <style> runtime, same class names as production', async () => {
    const dev = await build('app_same', {
      development: true,
      outName: 'app_same_dev',
    });
    const prod = await build('app_same', {
      production: true,
      outName: 'app_same_prod',
    });
    assert.ok(dev.cssFiles.length >= 2, `css files: ${dev.cssFiles}`);
    assert.ok(dev.cssFiles.includes('__federation_expose_App.css'));
    for (const f of dev.cssFiles) {
      assert.doesNotMatch(f, NGINX_IMMUTABLE, `${f} is not content-hashed`);
      assert.match(
        dev.read(f),
        new RegExp(`sourceMappingURL=${f.replace('.', '\\.')}\\.map`),
        'linked CSS map (not an inline data: URI)',
      );
      assert.ok(dev.files.includes(`${f}.map`), `${f}.map emitted`);
    }
    assert.doesNotMatch(dev.js, /insertStyleElement|styleTagTransform/);
    assert.doesNotMatch(dev.css, /data:application\/json/);
    const classes = (/** @type {string} */ css) =>
      [
        ...css.matchAll(
          /\.([A-Z][A-Za-z0-9]*_[A-Za-z0-9]+__[A-Za-z0-9_-]{5})(?=[\s{:,.>[)])/g,
        ),
      ]
        .map((m) => m[1])
        .sort();
    assert.deepEqual(
      [...new Set(classes(dev.css))].map((c) => c.replace(/__.*/, '')),
      ['Lazy_lazy', 'Widget_widget'],
    );
    assert.deepEqual(
      [...new Set(classes(dev.css))],
      [...new Set(classes(prod.css))],
    );
  });

  it('production: hidden source maps without sourcesContent, no dev-only code anywhere', async () => {
    const prod = await build('app_prod', { production: true });
    assert.ok(prod.maps.length > 0, '.map files emitted');
    assert.doesNotMatch(
      prod.js,
      /^\/\/# sourceMappingURL=/m,
      'no map reference',
    );
    assert.doesNotMatch(prod.js, /webpack:\/\/\.\/src/, 'no inline CSS maps');
    assert.doesNotMatch(prod.js, /dev-only-marker/, 'bundle has no dev branch');
    for (const map of prod.maps) {
      const json = JSON.parse(map);
      assert.ok(json.mappings, 'mappings kept');
      assert.ok(
        !json.sourcesContent?.some(Boolean),
        'no sourcesContent in the map',
      );
      assert.doesNotMatch(map, /localhost/);
    }
  });
});
