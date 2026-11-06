/** What an exposed module must never reach: global styles, the service worker registration. */
export declare const DEFAULT_FORBIDDEN: RegExp[];

/**
 * Walk the local import graph (relative and `@/` imports, styles included) from a remote's
 * exposed module and report every file that matches a forbidden pattern.
 */
export declare function scanExposedModule(
  entry: string,
  options?: {
    /** Target of the `@/` alias. Default: the folder above the entry's folder (`src/`). */
    srcDir?: string;
    forbidden?: RegExp[];
  },
): {
  /** Every file reached (absolute paths). */
  files: string[];
  violations: { file: string; pattern: string }[];
};
