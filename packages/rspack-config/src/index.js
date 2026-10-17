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

const require = createRequire(import.meta.url);

/**
 * Tier-1 core singletons (D4): one version for every app, shared at runtime with
 * `singleton + strictVersion + requiredVersion`. Anything that holds React context must be here.
 * tools/scripts/check-versions (A5) keeps this list in sync with the catalog.
 */
const TIER1_SINGLETONS = ['react', 'react-dom', 'react-router', '@org/ui'];

const FEDERATION_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

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
 * Style loaders: SCSS/CSS through sass-loader + css-loader + style-loader.
 * style-loader injects CSS from JS, so an exposed module brings its styles along when a shell
 * loads it (no separate CSS chunk loading across origins).
 * CSS Module class names are salted with the federation name so two apps never generate the
 * same class name for e.g. `Button.module.scss` `.button`.
 * @param {{ name: string, isDev: boolean, modules: boolean }} o
 */
function styleLoaders({ name, isDev, modules }) {
  return [
    { loader: require.resolve('style-loader') },
    {
      loader: require.resolve('css-loader'),
      options: {
        importLoaders: 1,
        modules: modules
          ? {
              namedExport: false,
              exportLocalsConvention: 'as-is',
              localIdentName: isDev
                ? '[name]__[local]__[hash:base64:5]'
                : '[hash:base64:8]',
              localIdentHashSalt: name,
            }
          : false,
      },
    },
    {
      loader: require.resolve('sass-loader'),
      options: { implementation: sass, api: 'modern' },
    },
  ];
}

/**
 * Serve `devManifest` (a JSON file in the app) as `/mfe-manifest.json` in development.
 * In production the file is written per environment by DevOps (never built in).
 * @param {string} file
 * @returns {NonNullable<import('@rspack/dev-server').Configuration['setupMiddlewares']>}
 */
function devManifestMiddleware(file) {
  return (middlewares) => {
    middlewares.unshift({
      name: 'mfe-dev-manifest',
      path: '/mfe-manifest.json',
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
 * Shared base for shells and remotes.
 * @param {BaseOptions & { kind: 'shell' | 'remote', exposes?: Record<string, string>, pwa?: boolean, devManifest?: string | false }} options
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
  } = options;
  if (!rootDir || !path.isAbsolute(rootDir)) {
    throw new Error(
      '[@org/rspack-config] rootDir must be an absolute path (use import.meta.dirname).',
    );
  }
  assertFederationName(name);
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
      templateParameters: {
        manifestLink: pwa
          ? '<link rel="manifest" href="/manifest.webmanifest" />'
          : '',
      },
    }),
    new rspack.DefinePlugin({
      __MFE_NAME__: JSON.stringify(name),
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
  if (!isDev && pwa) {
    plugins.push(new PwaPlugin());
  }

  /** @type {Configuration} */
  const config = {
    name,
    mode,
    context: rootDir,
    target: 'web',
    devtool: isDev ? 'cheap-module-source-map' : 'source-map',
    entry: { main: entry },
    output: {
      path: path.join(rootDir, 'dist'),
      // Shell: '/', so deep links (/apps/x/route-1) load chunks from the origin root.
      // Remote: 'auto', so chunks resolve against the remote's own origin (from mf-manifest).
      publicPath: kind === 'shell' ? '/' : 'auto',
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
      historyApiFallback: { index: '/index.html', disableDotRule: true },
      allowedHosts: 'all',
      // A shell on another port loads this app's mf-manifest.json / chunks.
      headers: { 'Access-Control-Allow-Origin': '*' },
      client: { overlay: { errors: true, warnings: false } },
      static: hasPublicDir ? { directory: publicDirAbs } : false,
      ...(devManifest
        ? {
            setupMiddlewares: devManifestMiddleware(
              path.resolve(rootDir, devManifest),
            ),
          }
        : {}),
    },
  };
  return config;
}

/**
 * Shell (host) config: publicPath '/', no exposes, dev manifest served at /mfe-manifest.json,
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
        exposes: options.exposes ?? { './App': './src/app/RemoteApp.tsx' },
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
  installedVersion,
  TIER1_SINGLETONS,
};
