// Style module declarations for the ui package's own sources.
// (Bundled by the consuming app's Rspack build; see @org/rspack-config.)
declare module '*.module.scss' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
