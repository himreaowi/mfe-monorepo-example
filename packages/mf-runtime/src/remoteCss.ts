import {
  registerPlugins,
  type ModuleFederationRuntimePlugin,
} from '@module-federation/enhanced/runtime';

const CSS_FILE = /\.css(?:[?#]|$)/i;

/**
 * Production builds extract each chunk's CSS into a hashed `.css` file (`@org/rspack-config`).
 * The remote's own chunk loader (CssExtractRspackPlugin runtime in its `remoteEntry.js`) loads
 * the CSS of the exposed module and of every lazy chunk as `<link rel="stylesheet">` from the
 * remote's origin and resolves the chunk only after the stylesheet's `load` event: no flash of
 * unstyled content, and a CSS file that fails to load rejects `loadRemote` (→ retry →
 * `RemoteFallback`), exactly like a failed JS chunk. It never adds a second `<link>` for a file
 * that is already in the document.
 *
 * The Module Federation runtime additionally "preloads" the exposed module's CSS from
 * `mf-manifest.json` when `loadRemote` resolves a manifest remote: it appends the same
 * `<link rel="stylesheet">` without waiting for it and swallows its errors. The chunk loader then
 * finds that link and treats it as loaded, so the remote could render before its CSS arrived,
 * and a failed stylesheet would leave an unstyled remote instead of the fallback. This plugin
 * removes `.css` files from those preloads (JS preloads stay), leaving CSS to the chunk loader.
 */
export const remoteCssPlugin: ModuleFederationRuntimePlugin = {
  name: 'org-remote-css-from-chunk-loader',
  // mutates the preload configs in place (the runtime reads them after this hook)
  beforePreloadRemote(args) {
    for (const preload of args.preloadOps) {
      const filter = preload.filter;
      preload.filter = (url: string) =>
        !CSS_FILE.test(url) && (filter ? filter(url) : true);
    }
  },
};

/** Register {@link remoteCssPlugin} with this build's federation runtime (idempotent). */
export function registerRemoteCssPlugin(): void {
  registerPlugins([remoteCssPlugin]);
}
