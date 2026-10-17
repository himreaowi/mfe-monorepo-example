/**
 * Where the vendor module comes from: host prop `vendor`, i.e. this remote's `props.vendor` in
 * the shell's mfe-manifest.json (per environment, written by DevOps; never baked into the
 * build). Example:
 *   "intranet_it_helpdesk": {
 *     "entry": "https://cdn.example.sg/it-helpdesk/mf-manifest.json",
 *     "props": { "vendor": { "url": "https://vendor.example/pay/1.4.2/mount.js", "format": "esm",
 *                            "integrity": "sha384-…", "config": { "merchantId": "…" } } }
 *   }
 *
 * Development builds fall back to the local mock vendor (tools/mock-vendor, port 3999) so the
 * adapter also works standalone. Rspack replaces `process.env.NODE_ENV` in production builds and
 * drops this branch, so the mock URL is not in production bundles.
 */
export function resolveVendorConfig(fromHost: unknown): unknown {
  if (fromHost !== undefined && fromHost !== null) return fromHost;
  if (process.env.NODE_ENV !== 'production') {
    return {
      url: 'http://localhost:3999/mount.js',
      format: 'esm',
      config: { title: 'It Helpdesk (mock vendor)', amount: 1250 },
    };
  }
  return undefined;
}
