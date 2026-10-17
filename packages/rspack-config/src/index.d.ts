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
  /** Dev server port (intranet 3100–3199, internet 3200–3299). */
  port: number;
  /** Force a mode. Default: from the Rspack CLI (`rspack dev` → development, `rspack build` → production). */
  mode?: 'development' | 'production';
  /** Entry module. Default `./src/main.tsx` (which does `import('./bootstrap')`). */
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
  /** Emit service worker + web manifest in production. */
  pwa?: boolean;
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
