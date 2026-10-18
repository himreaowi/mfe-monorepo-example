/**
 * Where the vendor module comes from: host prop `vendor`, i.e. this remote's `props.vendor` in
 * the shell's mfe-manifest.json (per environment, written by DevOps; never baked into the
 * build). Example:
 *   "intranet_it_helpdesk": {
 *     "entry": "https://cdn.example.org/it-helpdesk/mf-manifest.json",
 *     "props": { "vendor": { "url": "https://desk.acme.example/widget/1.0.0/mount.js",
 *                            "format": "esm", "integrity": "sha384-…",
 *                            "config": { "apiBaseUrl": "https://desk.acme.example/api" } } }
 *   }
 *
 * Development builds fall back to the example vendor (tools/example-vendors, port 3192) and
 * the mock API (tools/mock-api, port 3190) so the adapter also works standalone. Rspack replaces
 * `process.env.NODE_ENV` in production builds and drops this branch, so the dev URLs are not in
 * production bundles.
 */
export function resolveVendorConfig(fromHost: unknown): unknown {
  if (fromHost !== undefined && fromHost !== null) return fromHost;
  if (process.env.NODE_ENV !== 'production') {
    return {
      url: 'http://localhost:3192/helpdesk/1.0.0/mount.js',
      format: 'esm',
      config: { apiBaseUrl: 'http://localhost:3190/api' },
    };
  }
  return undefined;
}
