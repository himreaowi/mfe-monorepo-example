#!/usr/bin/env node
// @ts-check
/**
 * DEV ONLY: serves the example vendor modules like vendor CDNs would, on versioned URLs.
 * One server per zone, on the zone's tools range (`toolPort(zone, 'exampleVendors')`), serving
 * only that zone's vendor, so `pnpm dev:intranet` and `pnpm dev:internet` run at the same time:
 *   example-vendors --zone intranet   http://localhost:3192/helpdesk/1.0.0/mount.js
 *                                      "Acme Service Desk", format esm (it-helpdesk)
 *   example-vendors --zone internet   http://localhost:3292/payments/2.3.1/element.js
 *                                      "Bright Payments", format web-component (payments)
 *   example-vendors --port <n>        every vendor (tests, manual checks)
 * CORS "*", text/javascript. A real vendor serves immutable files (long cache + SRI); this dev
 * server sends no-store so edits show up on reload.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { ZONES, toolPort } from '@org/scripts/zones';

/** Vendor folder in src/ → the version it is published as. */
export const VENDORS = { helpdesk: '1.0.0', payments: '2.3.1' };

/** @typedef {keyof typeof VENDORS} VendorName */

/**
 * The vendors each zone uses (zones share nothing, not even a vendor server).
 * @type {Record<import('@org/scripts/zones').Zone, VendorName[]>}
 */
export const ZONE_VENDORS = { intranet: ['helpdesk'], internet: ['payments'] };

/** Dev port of a zone's example vendor server (intranet 3192, internet 3292). */
export function vendorPort(/** @type {string} */ zone) {
  if (!Object.hasOwn(ZONES, zone)) {
    throw new Error(
      `example-vendors: unknown zone "${zone}" (use ${Object.keys(ZONES).join(', ')})`,
    );
  }
  return toolPort(
    /** @type {import('@org/scripts/zones').Zone} */ (zone),
    'exampleVendors',
  );
}

/**
 * @param {{ port?: number, vendors?: VendorName[] }} [options] `vendors`: default all
 */
export function createServer({ port = 0, vendors } = {}) {
  const served = vendors ?? /** @type {VendorName[]} */ (Object.keys(VENDORS));
  const srcDir = path.resolve(import.meta.dirname, '..', 'src');
  return http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    if (url.pathname === '/') {
      res
        .writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
        .end(
          `Example vendors (dev only)\n${served
            .map((name) => `  /${name}/${VENDORS[name]}/`)
            .join('\n')}\n`,
        );
      return;
    }
    const match = /^\/([a-z]+)\/(\d+\.\d+\.\d+)\/([a-z-]+\.js)$/.exec(
      url.pathname,
    );
    const vendor = match?.[1];
    const known =
      vendor !== undefined &&
      served.includes(/** @type {VendorName} */ (vendor));
    const file = known && match ? path.join(srcDir, match[1], match[3]) : '';
    if (
      !known ||
      !match ||
      VENDORS[/** @type {VendorName} */ (vendor)] !== match[2] ||
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
  const { values } = parseArgs({
    options: { port: { type: 'string' }, zone: { type: 'string' } },
  });
  const zone = values.zone;
  if (!values.port && !(zone && Object.hasOwn(ZONES, zone))) {
    console.error(
      `example-vendors: pass --zone ${Object.keys(ZONES).join('|')} (or --port <n>)`,
    );
    process.exit(2);
  }
  const port = Number(values.port ?? vendorPort(/** @type {string} */ (zone)));
  const vendors =
    zone && Object.hasOwn(ZONE_VENDORS, zone)
      ? ZONE_VENDORS[/** @type {import('@org/scripts/zones').Zone} */ (zone)]
      : undefined;
  createServer({ port, vendors }).listen(port, () => {
    const list = (vendors ?? /** @type {VendorName[]} */ (Object.keys(VENDORS)))
      .map((name) => `/${name}/${VENDORS[name]}/`)
      .join(', ');
    console.log(
      `example vendors (dev only${zone ? `, ${zone}` : ''}) on http://localhost:${port}: ${list}`,
    );
  });
}
