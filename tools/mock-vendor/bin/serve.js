#!/usr/bin/env node
// @ts-check
/**
 * DEV ONLY: serves the mock vendor module like a vendor CDN would.
 *   mock-vendor [--port 3999]     (pnpm --filter @org/mock-vendor dev)
 * - /mount.js    format "esm"
 * - /element.js  format "web-component" (<mock-vendor-widget>)
 * - CORS "*", text/javascript, no caching (a real vendor uses versioned immutable URLs)
 * - /__down toggles "vendor down" (every module request answers 503) for fallback demos
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { parseArgs } from 'node:util';

export const DEFAULT_PORT = 3999;

/** @param {number} port */
export function createServer(port = DEFAULT_PORT) {
  const srcDir = path.resolve(import.meta.dirname, '..', 'src');
  let down = false;
  return http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    if (url.pathname === '/__down') {
      down = url.searchParams.get('value') !== '0';
      res
        .writeHead(200, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ down }));
      return;
    }
    if (url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(
        'Mock vendor (dev only)\n  /mount.js    format esm\n  /element.js  format web-component <mock-vendor-widget>\n',
      );
      return;
    }
    const file = path.join(
      srcDir,
      path.normalize(url.pathname).replace(/^([/\\])+/, ''),
    );
    if (
      !file.startsWith(srcDir) ||
      !file.endsWith('.js') ||
      !fs.existsSync(file)
    ) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found');
      return;
    }
    if (down) {
      res
        .writeHead(503, { 'Content-Type': 'text/plain' })
        .end('mock vendor is down (/__down?value=0 to restore)');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
    fs.createReadStream(file).pipe(res);
  });
}

if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('mock-vendor')
) {
  const { values } = parseArgs({ options: { port: { type: 'string' } } });
  const port = Number(
    values.port ?? process.env.MOCK_VENDOR_PORT ?? DEFAULT_PORT,
  );
  createServer(port).listen(port, () => {
    console.log(
      `mock vendor (dev only) on http://localhost:${port}/mount.js (esm), /element.js (web-component)`,
    );
  });
}
