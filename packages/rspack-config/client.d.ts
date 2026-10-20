// Ambient types for app sources built with @org/rspack-config.
// tsconfig: "types": ["@org/rspack-config/client"]
declare module '*.module.scss' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
declare module '*.scss';
declare module '*.css';
declare module '*.png' {
  const url: string;
  export default url;
}
declare module '*.svg' {
  const url: string;
  export default url;
}

/** Federation name of the app (DefinePlugin). */
declare const __MFE_NAME__: string;
/**
 * Base path of the shell (`/`, or e.g. `/citizen`; package.json `mfe.basePath` →
 * createShellConfig `basePath`). Always `/` in remotes. Read it with
 * `typeof __MFE_BASE_PATH__ === 'string' ? __MFE_BASE_PATH__ : '/'` so tests (no DefinePlugin)
 * fall back to `/`.
 */
declare const __MFE_BASE_PATH__: string;
