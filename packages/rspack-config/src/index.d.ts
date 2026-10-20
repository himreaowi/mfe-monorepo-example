import type { Configuration } from '@rspack/core';

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
  /** App directory (absolute). Use `import.meta.dirname` in rspack.config.js. */
  rootDir: string;
  /** Module Federation name, a JS identifier, unique across all apps (e.g. `intranet_staff`). Also salts CSS Module class names. */
  name: string;
  /** Dev server port (intranet 3100–3189, internet 3200–3289; see tools/scripts/src/zones.js). */
  port: number;
  /** Force a mode. Default: from the Rspack CLI (`rspack dev` → development, `rspack build` → production). */
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
   * Content-Security-Policy header of the dev server (`rspack dev`). Default `true`: the
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
  /** File served as /mfe-manifest.json by the dev server. Default `mfe-manifest.dev.json`; false = none. */
  devManifest?: string | false;
  /** Shells normally expose nothing. */
  exposes?: Record<string, string>;
}

export interface RemoteOptions extends BaseOptions {
  /** Exposed modules. Default `{ './App': './src/app/RemoteApp.tsx' }`. */
  exposes?: Record<string, string>;
}

export type ConfigFunction = (
  env?: Record<string, unknown>,
  argv?: Record<string, unknown>,
) => Configuration;

export declare const TIER1_SINGLETONS: string[];
/** The dev servers' Content-Security-Policy value (see `BaseOptions.devCsp`). */
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
