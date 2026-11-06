// Style module declarations for the ui package's own sources.
// (Bundled by the consuming app's webpack build; see @org/webpack-config.)
declare module '*.module.scss' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
