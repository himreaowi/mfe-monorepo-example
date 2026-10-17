/** Subset of Jest's `Config.InitialOptions` (kept loose to avoid a @jest/types dependency). */
export type JestConfig = Record<string, unknown>;

export declare const esmPackages: string[];
export declare function transformIgnorePatternFor(packages: string[]): string;
export declare const swcOptions: Record<string, unknown>;

export interface CreateJestConfigOptions {
  /** Usually `import.meta.dirname` of the consuming jest.config.js. */
  rootDir: string;
  /** Test environment. Default `jsdom`. */
  environment?: 'jsdom' | 'node';
  /** Extra ESM-only packages to transform. */
  extraEsmPackages?: string[];
  /** Extra `setupFilesAfterEnv` entries. */
  setupFiles?: string[];
  /** Merged last (shallow). */
  overrides?: JestConfig;
}

export declare function createJestConfig(
  options: CreateJestConfigOptions,
): JestConfig;
export default createJestConfig;
