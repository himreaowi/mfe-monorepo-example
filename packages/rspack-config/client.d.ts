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
