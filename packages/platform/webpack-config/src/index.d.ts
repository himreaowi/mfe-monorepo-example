import type { Configuration } from 'webpack';
import type {} from 'webpack-dev-server';

export type SharedConfig = Record<
  string,
  {
    singleton?: boolean;
    strictVersion?: boolean;
    requiredVersion?: string | false;
    version?: string;
    eager?: boolean;
  }
>;

export interface BaseOptions {
  /** App directory (absolute). Use `import.meta.dirname` in webpack.config.js. */
  rootDir: string;
  /** Module Federation name, a JS identifier, unique across all apps (e.g. `intranet_staff`). Also salts the hash of CSS Module class names. */
  name: string;
  /** Dev server port (intranet 3100–3189, internet 3200–3289; see tools/scripts/src/zones.js). */
  port: number;
  /** Force a mode. Default: from the webpack CLI (`webpack serve` → development, `webpack build` → production). */
  mode?: 'development' | 'production';
  /**
   * Entry module. Default `./src/main.tsx`. Module Federation starts asynchronously
   * (`experiments.asyncStartup`), so the entry imports React and renders directly.
   */
  entry?: string;
  /** HTML title. Default: name. */
  title?: string;
  /** Static files dir (served in dev, copied in prod). Default `public`. */
  publicDir?: string;
  /** HTML template. Default `public/index.html` if present, else the package template. */
  template?: string;
  /**
   * Prefix of the script/link URLs in the generated index.html. Default `/`, so deep links and
   * reloads of the standalone page work. Set it if the app's index.html is served below a
   * sub-path (e.g. `/staff/`).
   */
  htmlPublicPath?: string;
  /** Extra MF shared entries (e.g. an opt-in tier-2 non-singleton share). Merged after tier 1. */
  shared?: SharedConfig;
  /** Compile-time constants (JSON-stringified). Runtime config belongs in mfe-manifest.json. */
  define?: Record<string, unknown>;
  /**
   * Content-Security-Policy header of the dev server (`webpack serve`). Default `true`: the
   * production rules (no `'unsafe-inline'`/`'unsafe-eval'`, `frame-src 'none'`, …) with any
   * localhost origin allowed, so dev fails early on what production would block. Pass
   * `{ extraOrigins }` when the dev manifest points at non-local origins (a deployed remote, a
   * vendor sandbox, a shared dev API) and `{ frameSrc }` for iframes; `false` sends no CSP.
   */
  devCsp?: boolean | DevCspOptions;
  /** Emit service worker + web manifest in production. */
  pwa?: boolean;
  /**
   * `devtool` of production builds. Default `hidden-nosources-source-map`: `.map` files with
   * mappings and file names but no `sourcesContent` (so dev-only source, e.g. localhost mock
   * URLs, never ends up in them) and no `sourceMappingURL` comment in the bundles. `false` = no
   * maps. Development always uses `cheap-module-source-map`.
   */
  productionSourceMap?:
    | 'hidden-nosources-source-map'
    | 'nosources-source-map'
    | 'hidden-source-map'
    | 'source-map'
    | false;
}

export interface DevCspOptions {
  /** More origins for script/style/img/font/connect/form-action (e.g. `https://dev-api.example.sg`). */
  extraOrigins?: string[];
  /** Allowed iframe origins (default: none, `frame-src 'none'`). */
  frameSrc?: string[];
}

export interface ShellOptions extends BaseOptions {
  /**
   * Where the shell is served: `/` (default) or a path like `/citizen` (package.json
   * `mfe.basePath`). Sets `output.publicPath` and the index.html URLs (`/citizen/`), the web
   * manifest link, `__MFE_BASE_PATH__` (router basename, manifest URL, service worker scope)
   * and, in dev, the URLs the dev server answers (assets, `/citizen/mfe-manifest.json`, history
   * fallback to `/citizen/index.html`, HMR socket `/citizen/ws`; `/` redirects to `/citizen/`).
   */
  basePath?: string;
  /** File served as /mfe-manifest.json by the dev server. Default `mfe-manifest.dev.json`; false = none. */
  devManifest?: string | false;
  /** Shells normally expose nothing. */
  exposes?: Record<string, string>;
}

export interface RemoteOptions extends BaseOptions {
  /** Exposed modules. Default `{ './App': './src/app/apps.tsx' }`. */
  exposes?: Record<string, string>;
}

export type ConfigFunction = (
  env?: Record<string, unknown>,
  argv?: Record<string, unknown>,
) => Configuration;

export declare const TIER1_SINGLETONS: string[];
/** CSS Module class name pattern: `[name]_[local]__[hash:base64:5]` (dev and prod). */
export declare const LOCAL_IDENT_NAME: string;
/** css-loader `getLocalIdent`: `[name]` = file name without `.module.scss` (`Button_button__x3Yb1`). */
export declare function getLocalIdent(
  loaderContext: { resourcePath: string },
  localIdentName: string,
  localName: string,
  options: Record<string, unknown>,
): string;
/** The dev servers' Content-Security-Policy value (see `BaseOptions.devCsp`). */
/** `/`, or the path without trailing slash (`/citizen/` → `/citizen`). Throws on a malformed path. */
export declare function normalizeShellBasePath(
  basePath: string | undefined,
): string;
export declare function devContentSecurityPolicy(
  options?: DevCspOptions,
): string;
export declare function createShellConfig(
  options: ShellOptions,
): ConfigFunction;
export declare function createRemoteConfig(
  options: RemoteOptions,
): ConfigFunction;
export declare function createBaseConfig(
  options: BaseOptions & {
    kind: 'shell' | 'remote';
    exposes?: Record<string, string>;
    devManifest?: string | false;
    basePath?: string;
  },
  mode: 'development' | 'production',
): Configuration;
export declare function createSharedConfig(
  rootDir: string,
  opts?: { warn?: (msg: string) => void },
): SharedConfig;
export declare function installedVersion(
  rootDir: string,
  pkg: string,
): string | undefined;
