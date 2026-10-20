/** Brand shown in the header. */
export const APP_TITLE = 'Citizen Portal';
/** Module Federation name of this shell. */
export const FEDERATION_NAME = 'internet_shell_citizen';
/** One sentence under the title on the home page. */
export const APP_INTRO =
  'Government services in one place. Browse services and news without signing in; sign in to see your profile.';
/**
 * Where this shell is served: `/` or e.g. `/citizen` (package.json `mfe.basePath`, set at build
 * time by @org/rspack-config; `/` in unit tests). Router basename, manifest URL, service worker
 * scope. Route paths and links stay relative to it (`/` is the shell's home).
 */
export const BASE_PATH: string =
  typeof __MFE_BASE_PATH__ === 'string' ? __MFE_BASE_PATH__ : '/';
