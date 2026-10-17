/**
 * Where the vendor module comes from: host prop `vendor`, i.e. this remote's `props.vendor` in
 * the shell's mfe-manifest.json (per environment, written by DevOps; never baked into the
 * build). Example:
 *   "internet_payments": {
 *     "entry": "https://cdn.example.sg/payments/mf-manifest.json",
 *     "props": { "vendor": { "url": "https://pay.bright.example/checkout/2.3.1/element.js",
 *                            "format": "web-component", "tagName": "bright-checkout",
 *                            "integrity": "sha384-…",
 *                            "config": { "description": "…", "amount": 1500 } } }
 *   }
 *
 * Development builds fall back to the example vendor (tools/example-vendors, port 3990) so the
 * adapter also works standalone. Rspack replaces `process.env.NODE_ENV` in production builds
 * and drops this branch, so the dev URL is not in production bundles.
 */
export function resolveVendorConfig(fromHost: unknown): unknown {
  if (fromHost !== undefined && fromHost !== null) return fromHost;
  if (process.env.NODE_ENV !== 'production') {
    return {
      url: 'http://localhost:3990/payments/2.3.1/element.js',
      format: 'web-component',
      tagName: 'bright-checkout',
      config: {
        title: 'Pay your dog licence',
        description: 'Dog licence renewal 2027',
        amount: 1500,
        currency: 'SGD',
      },
    };
  }
  return undefined;
}
