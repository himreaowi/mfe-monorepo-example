// Applies a Content-Security-Policy close to the production host before the module loads.
// `?csp=<origins>` adds origins (space separated). Must run before host.js loads any module.
const params = new URLSearchParams(location.search);
const extra = (params.get('csp') ?? '').trim();
const bundle = params.get('url');
let bundleOrigin = '';
try {
  bundleOrigin = bundle ? new URL(bundle, location.href).origin : '';
} catch {
  /* invalid URL: the form shows it */
}
const origins = ["'self'", bundleOrigin, extra].filter(Boolean).join(' ');
const policy = [
  "default-src 'self'",
  `script-src ${origins}`,
  `style-src ${origins}`,
  `connect-src ${origins}`,
  `img-src ${origins} data:`,
  `font-src ${origins}`,
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');
const meta = document.createElement('meta');
meta.httpEquiv = 'Content-Security-Policy';
meta.content = policy;
document.head.prepend(meta);
document.documentElement.dataset.csp = policy;
