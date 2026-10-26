import type { Compiler } from 'webpack';

export interface GenerateServiceWorkerOptions {
  /** Directory containing the built app (globDirectory). */
  outputDir: string;
  /** Service worker file name inside outputDir. Default `service-worker.js`. */
  swDest?: string;
  /** Extra glob patterns to keep out of the precache. */
  globIgnores?: string[];
  maximumFileSizeToCacheInBytes?: number;
}

export declare function generateServiceWorker(
  options: GenerateServiceWorkerOptions,
): Promise<{ count: number; size: number; warnings: string[] }>;

export declare function defaultAssetFiles(): Array<[string, string]>;
export declare const assetsDir: string;
export declare const PRECACHE_IGNORES: string[];

export interface PwaPluginOptions {
  /** Emit the package's default manifest.webmanifest + icons when the app has none. Default true. */
  defaultAssets?: boolean;
  swDest?: string;
  globIgnores?: string[];
}

export declare class PwaPlugin {
  constructor(options?: PwaPluginOptions);
  options: PwaPluginOptions;
  apply(compiler: Compiler): void;
}
