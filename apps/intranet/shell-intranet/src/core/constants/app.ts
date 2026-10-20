/** Brand shown in the header. */
export const APP_TITLE = 'Staff Portal';
/** Module Federation name of this shell. */
export const FEDERATION_NAME = 'intranet_shell';
/** One sentence under the title on the home page. */
export const APP_INTRO =
  'Everything you need at work: find colleagues, manage your leave and get IT help.';
/**
 * Where this shell is served: `/` or e.g. `/citizen` (package.json `mfe.basePath`, set at build
 * time by @org/webpack-config; `/` in unit tests). Router basename, manifest URL, service worker
 * scope. Route paths and links stay relative to it (`/` is the shell's home).
 */
export const BASE_PATH: string =
  typeof __MFE_BASE_PATH__ === 'string' ? __MFE_BASE_PATH__ : '/';
