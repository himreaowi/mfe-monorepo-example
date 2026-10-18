#!/usr/bin/env node
// @ts-check
/**
 * DEV ONLY: serves the mock vendor module like a vendor CDN would.
 *   mock-vendor --zone intranet|internet   (port from the zone's tools range: 3191 / 3291)
 *   mock-vendor --port <n>
 * `pnpm dev:<zone>` starts it through the adapters' Nx task dependency (target `serve:<zone>`),
 * so both zones can run at the same time.
 * - /mount.js    format "esm"
 * - /element.js  format "web-component" (<mock-vendor-widget>)
 * - /script.js   format "script" (sets window.MockVendor = { contractVersion, mount })
 * - CORS "*", text/javascript, no caching (a real vendor uses versioned immutable URLs)
 * - /__down toggles "vendor down" (every module request answers 503) for fallback demos
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { ZONES, toolPort } from '@org/scripts/zones';

/** Global set by /script.js (format "script"). */
export const SCRIPT_GLOBAL = 'MockVendor';

const SRC_DIR = path.resolve(import.meta.dirname, '..', 'src');

/**
 * mount.js as a classic script: the same code in an IIFE that sets one namespaced global.
 * @returns {string}
 */
export function classicScript() {
  const esm = fs.readFileSync(path.join(SRC_DIR, 'mount.js'), 'utf8');
  return `// DEV ONLY mock vendor, format "script" (generated from mount.js)\n(function () {\n${esm.replace(
    /^export /gm,
    '',
  )}\nwindow.${SCRIPT_GLOBAL} = { contractVersion, mount };\n})();\n`;
}

/** @param {number} [port] only used for absolute URLs in messages */
export function createServer(port = 0) {
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
        'Mock vendor (dev only)\n  /mount.js    format esm\n  /element.js  format web-component <mock-vendor-widget>\n  /script.js   format script (window.MockVendor)\n',
      );
      return;
    }
    const isScript = url.pathname === '/script.js';
    const file = path.join(
      SRC_DIR,
      path.normalize(url.pathname).replace(/^([/\\])+/, ''),
    );
    if (
      !isScript &&
      (!file.startsWith(SRC_DIR) ||
        !file.endsWith('.js') ||
        !fs.existsSync(file))
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
    if (isScript) {
      res.end(classicScript());
      return;
    }
    fs.createReadStream(file).pipe(res);
  });
}

if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('mock-vendor')
) {
  const { values } = parseArgs({
    options: { port: { type: 'string' }, zone: { type: 'string' } },
  });
  const zone = values.zone;
  if (!values.port && !(zone && Object.hasOwn(ZONES, zone))) {
    console.error(
      `mock-vendor: pass --zone ${Object.keys(ZONES).join('|')} (or --port <n>)`,
    );
    process.exit(2);
  }
  const port = Number(
    values.port ??
      toolPort(
        /** @type {import('@org/scripts/zones').Zone} */ (zone),
        'mockVendor',
      ),
  );
  createServer(port).listen(port, () => {
    console.log(
      `mock vendor (dev only${zone ? `, ${zone}` : ''}) on http://localhost:${port}/mount.js (esm), /element.js (web-component), /script.js (script)`,
    );
  });
}
