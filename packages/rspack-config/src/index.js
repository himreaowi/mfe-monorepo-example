// @ts-check
/**
 * Rspack + Module Federation 2 config factories (replaces starter-mfe webpack.common/dev/prod).
 *
 *   // apps/<zone>/<name>/rspack.config.js
 *   import { createRemoteConfig } from '@org/rspack-config';
 *   export default createRemoteConfig({ rootDir: import.meta.dirname, name: 'intranet_staff', port: 3101 });
 *
 * Each factory returns a config function `(env, argv) => Configuration` for the Rspack CLI.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { rspack } from '@rspack/core';
import { ModuleFederationPlugin } from '@module-federation/enhanced/rspack';
import { PwaPlugin } from '@org/pwa/build';
import * as sass from 'sass';
import { TIER1_SINGLETONS } from './tier1.js';

const require = createRequire(import.meta.url);
/** css-loader's own class name function (css-loader ships no type declarations). */
const { defaultGetLocalIdent } =
  /** @type {{ defaultGetLocalIdent: (loaderContext: any, localIdentName: string, localName: string, options: any) => string }} */ (
    require(require.resolve('css-loader'))
  );

const FEDERATION_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
/** Same rule as `BASE_PATH` in tools/scripts/src/zones.js (pnpm check). */
const BASE_PATH =
  /^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)?$/;

/**
 * A shell's base path: `/` or `/citizen` (no trailing slash).
 * @param {string | undefined} basePath
 * @returns {string}
 */
function normalizeShellBasePath(basePath) {
  if (basePath === undefined || basePath === '' || basePath === '/') return '/';
  const trimmed = basePath.replace(/\/+$/, '');
  if (!BASE_PATH.test(trimmed)) {
    throw new Error(
      `[@org/rspack-config] Invalid basePath "${basePath}". Use "/" or a path like "/citizen" (lowercase letters, digits, "-").`,
    );
  }
  return trimmed;
}

/** @typedef {import('@rspack/core').Configuration} Configuration */
/** @typedef {import('./index.d.ts').BaseOptions} BaseOptions */
/** @typedef {import('./index.d.ts').ShellOptions} ShellOptions */
/** @typedef {import('./index.d.ts').RemoteOptions} RemoteOptions */
/** @typedef {import('./index.d.ts').ConfigFunction} ConfigFunction */
/** @typedef {import('./index.d.ts').SharedConfig} SharedConfig */

/** @param {string} name */
function assertFederationName(name) {
  if (typeof name !== 'string' || !FEDERATION_NAME.test(name)) {
    throw new Error(
      `[@org/rspack-config] Invalid federation name "${name}". Use letters, digits and "_" ` +
        '(a valid JS identifier, e.g. "intranet_staff_directory").',
    );
  }
}

/**
 * Installed version of `pkg` as seen from the app (equals the catalog version for catalog
 * packages, or the workspace package version for @org/*). `undefined` if not installed.
 * @param {string} rootDir
 * @param {string} pkg
 * @returns {string | undefined}
 */
function installedVersion(rootDir, pkg) {
  const req = createRequire(path.join(rootDir, 'package.json'));
  try {
    return JSON.parse(
      fs.readFileSync(req.resolve(`${pkg}/package.json`), 'utf8'),
    ).version;
  } catch {
    // packages without "./package.json" in exports: walk up from the entry
    try {
      let dir = path.dirname(req.resolve(pkg));
      while (dir !== path.dirname(dir)) {
        const file = path.join(dir, 'package.json');
        if (fs.existsSync(file)) {
          const json = JSON.parse(fs.readFileSync(file, 'utf8'));
          if (json.name === pkg) return json.version;
        }
        dir = path.dirname(dir);
      }
    } catch {
      /* not installed */
    }
  }
  return undefined;
}

/**
 * MF `shared` config for the tier-1 singletons the app has installed: exact
 * `requiredVersion`, `singleton`, `strictVersion` (a mismatch fails loudly at load time and the
 * host shows RemoteFallback instead of running two Reacts).
 * @param {string} rootDir
 * @param {{ warn?: (msg: string) => void }} [opts]
 * @returns {SharedConfig}
 */
function createSharedConfig(rootDir, opts = {}) {
  /** @type {SharedConfig} */
  const shared = {};
  for (const pkg of TIER1_SINGLETONS) {
    const version = installedVersion(rootDir, pkg);
    if (!version) {
      opts.warn?.(
        `[@org/rspack-config] tier-1 package "${pkg}" is not a dependency of ${rootDir}; it is not shared.`,
      );
      continue;
    }
    shared[pkg] = {
      singleton: true,
      strictVersion: true,
      requiredVersion: version,
      version,
    };
  }
  return shared;
}

/**
 * @param {Record<string, unknown>} env
 * @param {Record<string, unknown>} argv
 * @param {BaseOptions['mode']} explicit
 * @returns {'development' | 'production'}
 */
function resolveMode(env, argv, explicit) {
  if (explicit) return explicit;
  if (argv.mode === 'development' || argv.mode === 'production')
    return argv.mode;
  if (env.RSPACK_SERVE) return 'development';
  if (env.RSPACK_BUILD) return 'production';
  return process.env.NODE_ENV === 'production' ? 'production' : 'development';
}

/**
 * Style loaders, the same in development and production: sass-loader → css-loader →
 * CssExtractRspackPlugin's loader. Each JS chunk's CSS becomes a real .css file that the chunk
 * loader fetches as <link rel="stylesheet"> (from the app's own origin via publicPath) and
 * awaits before the chunk's code runs, also when a shell loads a remote's exposed module. No
 * <style> element at runtime, so the CSP needs no `style-src 'unsafe-inline'` (the dev servers
 * send such a CSP too, see devContentSecurityPolicy).
 * - development: unhashed `[name].css` with linked `.css.map` files; the extract loader adds a
 *   small HMR handler, so an edited stylesheet is swapped by re-fetching its <link> (no reload).
 * - production: `[name].[contenthash:8].css`, no CSS source maps.
 * CSS Module class names are readable and identical in both modes: `<Component>_<class>__<hash>`
 * (`Button.module.scss` `.button` → `Button_button__x3Yb1`, see `getLocalIdent`), the hash
 * salted with the federation name so two apps never generate the same class name for the same
 * file and class.
 * @param {{ name: string, isDev: boolean, modules: boolean }} o
 */
function styleLoaders({ name, isDev, modules }) {
  return [
    { loader: rspack.CssExtractRspackPlugin.loader },
    {
      loader: require.resolve('css-loader'),
      options: {
        importLoaders: 1,
        // no CSS source maps in production (neither inline nor as .css.map files)
        sourceMap: isDev,
        modules: modules
          ? {
              namedExport: false,
              exportLocalsConvention: 'as-is',
              localIdentName: LOCAL_IDENT_NAME,
              getLocalIdent,
              localIdentHashSalt: name,
            }
          : false,
      },
    },
    {
      loader: require.resolve('sass-loader'),
      options: { implementation: sass, api: 'modern', sourceMap: isDev },
    },
  ];
}

/**
 * CSS Module class names: `[name]_[local]__[hash:base64:5]` in development AND production, where
 * `[name]` is the stylesheet's component name without `.module` (see `getLocalIdent`).
 */
const LOCAL_IDENT_NAME = '[name]_[local]__[hash:base64:5]';

/**
 * css-loader `getLocalIdent`: like the default, but `[name]` is the file name without
 * `.module.scss` / `.module.css` (css-loader's `[name]` would be `Button.module`, and the dot
 * becomes `-`), so `Button.module.scss` `.button` → `Button_button__x3Yb1`. The hash
 * (resource path + class name, salted with `localIdentHashSalt` = the federation name) is
 * css-loader's own.
 * @param {any} loaderContext
 * @param {string} localIdentName
 * @param {string} localName
 * @param {any} options
 * @returns {string}
 */
function getLocalIdent(loaderContext, localIdentName, localName, options) {
  const component = path
    .basename(loaderContext.resourcePath)
    .replace(/(\.module)?\.s?css$/, '');
  return defaultGetLocalIdent(
    loaderContext,
    localIdentName
      .replace(/\[name\]/gi, component)
      .replace(/\[local\]/gi, localName),
    localName,
    options,
  );
}

/** Local dev origins: every dev server, mock API and mock vendor runs on localhost. */
const DEV_ORIGINS = ['http://localhost:*', 'http://127.0.0.1:*'];
/** HMR websockets of the dev servers (a shell page also connects to each remote's server). */
const DEV_SOCKETS = ['ws://localhost:*', 'ws://127.0.0.1:*'];

/**
 * Content-Security-Policy the dev servers send: the production policy (deploy/nginx
 * security-headers.inc.template) with the remote/vendor/API origin lists replaced by any
 * localhost port, plus the HMR websockets. Same rules where it matters: no `'unsafe-inline'`
 * (no `<style>` elements, no inline scripts), no `'unsafe-eval'`, `object-src 'none'`,
 * `frame-src 'none'` unless `frameSrc` is given. Left out: production's
 * `upgrade-insecure-requests` (dev servers are plain http).
 * @param {{ extraOrigins?: string[], frameSrc?: string[] }} [options] extraOrigins: more origins
 *   for script/style/img/font/connect/form-action (e.g. a deployed remote or a vendor sandbox
 *   the dev manifest points at); frameSrc: allowed iframe origins
 * @returns {string}
 */
function devContentSecurityPolicy({ extraOrigins = [], frameSrc = [] } = {}) {
  const origins = [...DEV_ORIGINS, ...extraOrigins].join(' ');
  return [
    "default-src 'self'",
    `script-src 'self' ${origins}`,
    `style-src 'self' ${origins}`,
    `img-src 'self' data: ${origins}`,
    `font-src 'self' ${origins}`,
    `connect-src 'self' ${origins} ${DEV_SOCKETS.join(' ')}`,
    `frame-src ${frameSrc.length ? frameSrc.join(' ') : "'none'"}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    `form-action 'self' ${origins}`,
    "frame-ancestors 'none'",
  ].join('; ');
}

/**
 * Serve `devManifest` (a JSON file in the app) as `/mfe-manifest.json` in development.
 * In production the file is written per environment by DevOps (never built in).
 * @param {string} file
 * @param {string} [prefix] the shell's public path (`/` or `/citizen/`)
 * @returns {NonNullable<import('@rspack/dev-server').Configuration['setupMiddlewares']>}
 */
function devManifestMiddleware(file, prefix = '/') {
  return (middlewares) => {
    middlewares.unshift({
      name: 'mfe-dev-manifest',
      path: `${prefix}mfe-manifest.json`,
      middleware: (
        /** @type {import('node:http').IncomingMessage} */ _req,
        /** @type {import('node:http').ServerResponse} */ res,
      ) => {
        try {
          const body = fs.readFileSync(file, 'utf8');
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(body);
        } catch {
          res.statusCode = 404;
          res.end(`mfe-manifest.json: dev manifest not found at ${file}`);
        }
      },
    });
    return middlewares;
  };
}

/**
 * Dev server of a shell below a base path: `/` (and the bare base path without slash) redirect
 * to `<basePath>/`, so `http://localhost:<shell port>/` still opens the shell.
 * @param {string} basePath e.g. `/citizen`
 * @returns {(middlewares: any[]) => any[]}
 */
function basePathRedirectMiddleware(basePath) {
  return (middlewares) => {
    middlewares.unshift({
      name: 'mfe-base-path-redirect',
      middleware: (
        /** @type {import('node:http').IncomingMessage} */ req,
        /** @type {import('node:http').ServerResponse} */ res,
        /** @type {() => void} */ next,
      ) => {
        const pathname = (req.url ?? '/').split('?')[0];
        if (pathname === '/' || pathname === basePath) {
          res.statusCode = 302;
          res.setHeader('Location', `${basePath}/`);
          res.end();
          return;
        }
        next();
      },
    });
    return middlewares;
  };
}

/**
 * Shared base for shells and remotes.
 * @param {BaseOptions & { kind: 'shell' | 'remote', exposes?: Record<string, string>, pwa?: boolean, devManifest?: string | false, basePath?: string }} options
 * @param {'development' | 'production'} mode
 * @returns {Configuration}
 */
function createBaseConfig(options, mode) {
  const {
    rootDir,
    name,
    port,
    kind,
    entry = './src/main.tsx',
    title = name,
    publicDir = 'public',
    template,
    exposes = {},
    shared: extraShared = {},
    define = {},
    pwa = false,
    devManifest = false,
    basePath: rawBasePath,
    devCsp = true,
    productionSourceMap = 'hidden-nosources-source-map',
  } = options;
  if (!rootDir || !path.isAbsolute(rootDir)) {
    throw new Error(
      '[@org/rspack-config] rootDir must be an absolute path (use import.meta.dirname).',
    );
  }
  assertFederationName(name);
  // shells: `/` or e.g. `/citizen` (remotes are always served from their own origin root)
  const basePath = kind === 'shell' ? normalizeShellBasePath(rawBasePath) : '/';
  /** `/` or `/citizen/`: prefix of every URL the shell serves itself. */
  const publicPrefix = basePath === '/' ? '/' : `${basePath}/`;
  const { htmlPublicPath = publicPrefix } = options;
  if (!Number.isInteger(port)) {
    throw new Error(
      `[@org/rspack-config] port must be an integer (got ${port}).`,
    );
  }

  const isDev = mode === 'development';
  const publicDirAbs = path.resolve(rootDir, publicDir);
  const hasPublicDir = fs.existsSync(publicDirAbs);
  const templatePath = template
    ? path.resolve(rootDir, template)
    : fs.existsSync(path.join(publicDirAbs, 'index.html'))
      ? path.join(publicDirAbs, 'index.html')
      : path.join(import.meta.dirname, '..', 'templates', 'index.html');

  /** @type {string[]} */
  const warnings = [];
  const shared = {
    ...createSharedConfig(rootDir, { warn: (m) => warnings.push(m) }),
    ...extraShared,
  };
  for (const w of warnings) console.warn(w);

  const swcOptions = {
    jsc: {
      target: 'es2022',
      parser: { syntax: 'typescript', tsx: true },
      transform: {
        react: { runtime: 'automatic', development: isDev },
      },
    },
  };

  /** @type {Configuration['plugins']} */
  const plugins = [
    new rspack.HtmlRspackPlugin({
      template: templatePath,
      title,
      // Only the app entry. Without this the standalone page can also get federation chunks
      // and render blank.
      chunks: ['main'],
      // Absolute script URLs in index.html, so a deep link or reload (/details) still loads
      // /main.js. A remote keeps output.publicPath 'auto' for its federation chunks.
      publicPath: htmlPublicPath,
      templateParameters: {
        manifestLink: pwa
          ? `<link rel="manifest" href="${publicPrefix}manifest.webmanifest" />`
          : '',
      },
    }),
    new rspack.DefinePlugin({
      __MFE_NAME__: JSON.stringify(name),
      // the shell's base path (`/`, `/citizen`): router basename, manifest URL, SW scope
      __MFE_BASE_PATH__: JSON.stringify(basePath),
      ...Object.fromEntries(
        Object.entries(define).map(([k, v]) => [k, JSON.stringify(v)]),
      ),
    }),
    new ModuleFederationPlugin({
      name,
      filename: 'remoteEntry.js',
      exposes,
      // Remotes are registered at runtime from /mfe-manifest.json (@org/mf-runtime).
      remotes: {},
      shared,
      manifest: true,
      dts: false,
      // Async startup: the runtime negotiates the shared singletons (react, react-dom,
      // react-router, @org/ui, @org/auth) before the entry module runs, so `src/main.tsx` can
      // import React directly (no `import('./bootstrap')` boundary file).
      experiments: { asyncStartup: true },
    }),
  ];

  if (!isDev && hasPublicDir) {
    plugins.push(
      new rspack.CopyRspackPlugin({
        patterns: [
          {
            from: publicDirAbs,
            to: '.',
            noErrorOnMissing: true,
            globOptions: {
              // index.html is the template; mfe-manifest.json is per environment (DevOps)
              ignore: ['**/index.html', '**/mfe-manifest*.json'],
            },
          },
        ],
      }),
    );
  }
  plugins.push(
    new rspack.CssExtractRspackPlugin({
      // production: 8 hex chars like the JS chunks (deploy/nginx caches `*.<8 hex>.css` as
      // immutable); development: stable names, HMR re-fetches them with a `?<timestamp>` query
      filename: isDev ? '[name].css' : '[name].[contenthash:8].css',
      chunkFilename: isDev ? '[name].css' : '[name].[contenthash:8].css',
    }),
  );
  if (!isDev && pwa) {
    plugins.push(new PwaPlugin());
  }

  /** @type {Configuration} */
  const config = {
    name,
    mode,
    context: rootDir,
    target: 'web',
    // Production: maps without sourcesContent and without a sourceMappingURL comment. The original
    // sources hold dev-only branches (mock vendor / mock API localhost URLs) that the minifier
    // drops from the bundles; `source-map` would copy them into the .map files. Mappings + file
    // names are enough for an error tracker to resolve stack traces (docs/devops-handoff.md).
    devtool: isDev ? 'cheap-module-source-map' : productionSourceMap,
    entry: { main: entry },
    output: {
      path: path.join(rootDir, 'dist'),
      // Shell: its base path ('/' or '/citizen/'), so deep links (/citizen/apps/x/route-1)
      // load chunks from the shell's folder. Remote: 'auto', so chunks resolve against the
      // remote's own origin (from mf-manifest).
      publicPath: kind === 'shell' ? publicPrefix : 'auto',
      uniqueName: name,
      filename: isDev ? '[name].js' : '[name].[contenthash:8].js',
      chunkFilename: isDev ? '[name].js' : '[name].[contenthash:8].js',
      clean: true,
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'],
      alias: { '@': path.join(rootDir, 'src') },
    },
    module: {
      rules: [
        {
          test: /\.[cm]?[jt]sx?$/,
          exclude: /node_modules/,
          loader: 'builtin:swc-loader',
          options: swcOptions,
          type: 'javascript/auto',
        },
        {
          test: /\.module\.s?css$/,
          use: styleLoaders({ name, isDev, modules: true }),
          type: 'javascript/auto',
        },
        {
          test: /\.s?css$/,
          exclude: /\.module\.s?css$/,
          use: styleLoaders({ name, isDev, modules: false }),
          type: 'javascript/auto',
        },
        {
          test: /\.(png|jpe?g|gif|svg|webp|avif|woff2?)$/i,
          type: 'asset',
        },
      ],
    },
    plugins,
    // Lazy compilation breaks federation entry loading (standalone remote renders blank).
    lazyCompilation: false,
    performance: { hints: false },
    devServer: {
      port,
      hot: true,
      // index.html for page navigations only (Accept: text/html). A missing .json/.js (e.g. the
      // hot-update manifest of a build that failed) must stay a 404: answered with index.html,
      // HMR fails on the JSON and stops updating instead of falling back to a full reload.
      historyApiFallback: {
        index: `${publicPrefix}index.html`,
        disableDotRule: true,
        htmlAcceptHeaders: ['text/html'],
      },
      allowedHosts: 'all',
      // A shell on another port loads this app's mf-manifest.json / chunks.
      // The CSP (production rules, localhost origins) makes dev fail early on anything production
      // would block: a <style> element, an inline script, an undeclared origin.
      headers: {
        'Access-Control-Allow-Origin': '*',
        ...(devCsp
          ? {
              'Content-Security-Policy': devContentSecurityPolicy(
                devCsp === true ? {} : devCsp,
              ),
            }
          : {}),
      },
      client: {
        overlay: { errors: true, warnings: false },
        // below a base path the HMR socket is too (`/citizen/ws`), so the zone's dev proxy
        // routes it to this shell; host and port follow the page (proxy or direct)
        ...(basePath === '/'
          ? {}
          : { webSocketURL: { pathname: `${publicPrefix}ws` } }),
      },
      ...(basePath === '/'
        ? {}
        : {
            webSocketServer: {
              type: 'ws',
              options: { path: `${publicPrefix}ws` },
            },
          }),
      static: hasPublicDir
        ? {
            directory: publicDirAbs,
            ...(basePath === '/' ? {} : { publicPath: basePath }),
          }
        : false,
      ...(devManifest || basePath !== '/'
        ? {
            setupMiddlewares: (
              /** @type {any[]} */ middlewares,
              /** @type {any} */ server,
            ) => {
              let list = middlewares;
              if (devManifest) {
                list = devManifestMiddleware(
                  path.resolve(rootDir, devManifest),
                  publicPrefix,
                )(list, server);
              }
              if (basePath !== '/') {
                list = basePathRedirectMiddleware(basePath)(list);
              }
              return list;
            },
          }
        : {}),
    },
  };
  return config;
}

/**
 * Shell (host) config: publicPath = its base path ('/' default), no exposes, dev manifest served at /mfe-manifest.json,
 * PWA (Workbox) in production.
 * @param {ShellOptions} options
 * @returns {ConfigFunction}
 */
function createShellConfig(options) {
  return (env = {}, argv = {}) => {
    const mode = resolveMode(env, argv, options.mode);
    return createBaseConfig(
      {
        ...options,
        kind: 'shell',
        exposes: options.exposes ?? {},
        pwa: options.pwa ?? true,
        devManifest: options.devManifest ?? 'mfe-manifest.dev.json',
        basePath: options.basePath,
      },
      mode,
    );
  };
}

/**
 * Remote config: publicPath 'auto', exposes `./App` by default, no PWA by default (a remote's
 * service worker would only apply when it runs standalone on its own origin).
 * @param {RemoteOptions} options
 * @returns {ConfigFunction}
 */
function createRemoteConfig(options) {
  return (env = {}, argv = {}) => {
    const mode = resolveMode(env, argv, options.mode);
    return createBaseConfig(
      {
        ...options,
        kind: 'remote',
        exposes: options.exposes ?? { './App': './src/app/apps.tsx' },
        pwa: options.pwa ?? false,
        devManifest: false,
      },
      mode,
    );
  };
}

export {
  createShellConfig,
  createRemoteConfig,
  createBaseConfig,
  createSharedConfig,
  devContentSecurityPolicy,
  getLocalIdent,
  installedVersion,
  normalizeShellBasePath,
  LOCAL_IDENT_NAME,
  TIER1_SINGLETONS,
};
