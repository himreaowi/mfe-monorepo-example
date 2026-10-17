// @ts-check
// Build-time PWA helpers (Node). Workbox via workbox-build, NOT workbox-webpack-plugin
// (that one imports webpack, which is not installed in an Rspack app).
const fs = require('node:fs');
const path = require('node:path');

const PLUGIN_NAME = 'OrgPwaPlugin';

/** Directory with the default manifest.webmanifest and icons/. */
const assetsDir = path.join(__dirname, '..', 'assets');

/**
 * Files that must never be precached.
 * - mfe-manifest.json: written per environment by DevOps; must always come from the network.
 * - mf-manifest.json / mf-stats.json / remoteEntry.js: federation metadata; must not be stale.
 */
const PRECACHE_IGNORES = [
  '**/mfe-manifest.json',
  '**/mf-manifest.json',
  '**/mf-stats.json',
  '**/remoteEntry.js',
  '**/*.map',
  '**/*.LICENSE.txt',
  '**/service-worker.js',
];

const PRECACHE_PATTERNS = [
  '**/*.{js,css,html,png,svg,ico,jpg,jpeg,webp,avif,woff,woff2,webmanifest}',
];

/**
 * Generate `service-worker.js` (Workbox GenerateSW) into an output directory.
 *
 * @param {{
 *   outputDir: string,
 *   swDest?: string,
 *   globIgnores?: string[],
 *   maximumFileSizeToCacheInBytes?: number,
 * }} options
 */
async function generateServiceWorker({
  outputDir,
  swDest = 'service-worker.js',
  globIgnores = [],
  maximumFileSizeToCacheInBytes = 5 * 1024 * 1024,
}) {
  const { generateSW } = require('workbox-build');
  return generateSW({
    globDirectory: outputDir,
    globPatterns: PRECACHE_PATTERNS,
    globIgnores: [...PRECACHE_IGNORES, ...globIgnores],
    swDest: path.join(outputDir, swDest),
    mode: 'production',
    sourcemap: false,
    inlineWorkboxRuntime: true,
    clientsClaim: true,
    skipWaiting: true,
    maximumFileSizeToCacheInBytes,
    runtimeCaching: [
      {
        // Not precached; network first so a new manifest is picked up immediately,
        // the cached copy is only used offline.
        urlPattern: ({ url }) => url.pathname.endsWith('/mfe-manifest.json'),
        handler: 'NetworkFirst',
        options: { cacheName: 'mfe-manifest' },
      },
      {
        urlPattern: ({ request }) => request.destination === 'document',
        handler: 'NetworkFirst',
        options: { cacheName: 'pages' },
      },
    ],
  });
}

/** @returns {Array<[string, string]>} [output file name, absolute source path] */
function defaultAssetFiles() {
  /** @type {Array<[string, string]>} */
  const files = [
    ['manifest.webmanifest', path.join(assetsDir, 'manifest.webmanifest')],
  ];
  for (const icon of fs.readdirSync(path.join(assetsDir, 'icons'))) {
    if (icon.startsWith('.')) continue;
    files.push([`icons/${icon}`, path.join(assetsDir, 'icons', icon)]);
  }
  return files;
}

/**
 * Rspack plugin:
 * 1. emits the default manifest.webmanifest + icons unless the app already emits its own
 *    (e.g. copied from its public/ folder), and
 * 2. after emit, generates service-worker.js with Workbox.
 * Use in production builds only.
 */
class PwaPlugin {
  /**
   * @param {{ defaultAssets?: boolean, swDest?: string, globIgnores?: string[] }} [options]
   */
  constructor(options = {}) {
    this.options = options;
  }

  /** @param {import('@rspack/core').Compiler} compiler */
  apply(compiler) {
    const { Compilation, sources } = compiler.webpack;
    const logger = compiler.getInfrastructureLogger(PLUGIN_NAME);

    if (this.options.defaultAssets !== false) {
      compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
        compilation.hooks.processAssets.tap(
          {
            name: PLUGIN_NAME,
            stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
          },
          () => {
            for (const [file, source] of defaultAssetFiles()) {
              if (compilation.getAsset(file)) continue;
              compilation.emitAsset(
                file,
                new sources.RawSource(fs.readFileSync(source)),
              );
            }
          },
        );
      });
    }

    compiler.hooks.afterEmit.tapPromise(PLUGIN_NAME, async (compilation) => {
      const outputDir = compilation.outputOptions.path;
      if (!outputDir) return;
      const { count, size, warnings } = await generateServiceWorker({
        outputDir,
        swDest: this.options.swDest,
        globIgnores: this.options.globIgnores,
      });
      for (const warning of warnings) logger.warn(warning);
      logger.info(
        `service worker generated: ${count} files precached (${size} bytes)`,
      );
    });
  }
}

module.exports = {
  PwaPlugin,
  generateServiceWorker,
  defaultAssetFiles,
  assetsDir,
  PRECACHE_IGNORES,
};
