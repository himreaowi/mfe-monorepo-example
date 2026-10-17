#!/usr/bin/env node
// @ts-check
/**
 * `pnpm preview` in an app: serve the production build (dist/) like a static host would.
 *   mfe-preview [--port <n>] [--dir dist] [--manifest <file>]
 * - port: package.json mfe.port by default (the same port as `pnpm dev`)
 * - CORS `*` (a shell on another origin loads a remote's mf-manifest.json and chunks)
 * - SPA fallback: unknown paths without a file extension → index.html
 * - /mfe-manifest.json: dist/mfe-manifest.json, or --manifest <file>. A production build never
 *   contains it (DevOps writes one per environment); for a local check, copy or point at one.
 * Reference only: real hosting is nginx (deploy/), not this script.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { parseArgs } from 'node:util';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const { values } = parseArgs({
  options: {
    port: { type: 'string' },
    dir: { type: 'string', default: 'dist' },
    manifest: { type: 'string' },
  },
});
const cwd = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
const port = Number(values.port ?? pkg.mfe?.port);
if (!Number.isInteger(port)) {
  console.error(
    'mfe-preview: no port (set mfe.port in package.json or pass --port).',
  );
  process.exit(2);
}
const distDir = path.resolve(cwd, values.dir ?? 'dist');
if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.error(
    `mfe-preview: ${distDir}/index.html not found. Run the build first.`,
  );
  process.exit(2);
}
const manifestFile = values.manifest
  ? path.resolve(cwd, values.manifest)
  : path.join(distDir, 'mfe-manifest.json');

/**
 * @param {http.ServerResponse} res
 * @param {string} file
 * @param {Record<string, string>} [headers]
 */
function send(res, file, headers = {}) {
  const type =
    TYPES[
      /** @type {keyof typeof TYPES} */ (path.extname(file).toLowerCase())
    ] ?? 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, ...headers });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const url = new URL(req.url ?? '/', 'http://localhost');
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (pathname === '/mfe-manifest.json') {
    if (fs.existsSync(manifestFile)) {
      send(res, manifestFile, { 'Cache-Control': 'no-cache' });
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(
        `mfe-manifest.json not found (${manifestFile}). Production builds do not contain it: copy one into dist/ or run "pnpm preview --manifest <file>".`,
      );
    }
    return;
  }
  const file = path.join(distDir, pathname);
  if (!file.startsWith(distDir)) {
    res.writeHead(403).end();
    return;
  }
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    const immutable = /\.[0-9a-f]{8}\.(?:js|css)$/.test(file);
    send(res, file, {
      'Cache-Control': immutable
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
    });
    return;
  }
  if (!path.extname(pathname)) {
    send(res, path.join(distDir, 'index.html'), {
      'Cache-Control': 'no-cache',
    });
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});
server.listen(port, () => {
  console.log(`mfe-preview: ${pkg.name} dist/ on http://localhost:${port}`);
});
