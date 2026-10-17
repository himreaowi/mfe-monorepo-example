#!/usr/bin/env node
// @ts-check
/**
 * DEV ONLY: serves the example vendor modules like vendor CDNs would, on versioned URLs.
 *   example-vendors [--port 3990]
 * - /helpdesk/1.0.0/mount.js     "Acme Service Desk", format esm          (intranet it-helpdesk)
 * - /payments/2.3.1/element.js   "Bright Payments", format web-component  (internet payments)
 * CORS "*", text/javascript. A real vendor serves immutable files (long cache + SRI); this dev
 * server sends no-store so edits show up on reload.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { parseArgs } from 'node:util';

export const DEFAULT_PORT = 3990;

/** Vendor folder in src/ → the version it is published as. */
export const VENDORS = { helpdesk: '1.0.0', payments: '2.3.1' };

/** @param {number} [port] */
export function createServer(port = DEFAULT_PORT) {
  const srcDir = path.resolve(import.meta.dirname, '..', 'src');
  return http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    if (url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }).end(
        `Example vendors (dev only)\n${Object.entries(VENDORS)
          .map(([name, version]) => `  /${name}/${version}/`)
          .join('\n')}\n`,
      );
      return;
    }
    const match = /^\/([a-z]+)\/(\d+\.\d+\.\d+)\/([a-z-]+\.js)$/.exec(
      url.pathname,
    );
    const vendor = match?.[1];
    const known = vendor !== undefined && Object.hasOwn(VENDORS, vendor);
    const file = known && match ? path.join(srcDir, match[1], match[3]) : '';
    if (
      !known ||
      !match ||
      VENDORS[/** @type {keyof typeof VENDORS} */ (vendor)] !== match[2] ||
      !fs.existsSync(file)
    ) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
    fs.createReadStream(file).pipe(res);
  });
}

if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('example-vendors')
) {
  const { values } = parseArgs({ options: { port: { type: 'string' } } });
  const port = Number(
    values.port ?? process.env.EXAMPLE_VENDORS_PORT ?? DEFAULT_PORT,
  );
  createServer(port).listen(port, () => {
    console.log(
      `example vendors (dev only) on http://localhost:${port}: /helpdesk/${VENDORS.helpdesk}/mount.js, /payments/${VENDORS.payments}/element.js`,
    );
  });
}
