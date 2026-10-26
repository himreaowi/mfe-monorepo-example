#!/usr/bin/env node
// @ts-check
/**
 * Serves the static Storybook build (storybook-static/) for the a11y and visual tests:
 *   node visual/serve.js <port>
 * Local only (127.0.0.1); started and stopped by Playwright's webServer.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', 'storybook-static');
const port = Number(process.argv[2]);
const TYPES = /** @type {Record<string, string>} */ ({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
});

if (!fs.existsSync(path.join(root, 'index.json'))) {
  console.error(`${root} has no build: run pnpm build-storybook first.`);
  process.exit(1);
}

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const file = path.join(
      root,
      path.normalize(decodeURIComponent(url.pathname)),
    );
    const target = file.endsWith(path.sep)
      ? path.join(file, 'index.html')
      : file;
    if (
      !target.startsWith(root) ||
      !fs.existsSync(target) ||
      fs.statSync(target).isDirectory()
    ) {
      res.writeHead(404).end('Not found');
      return;
    }
    res.writeHead(200, {
      'content-type': TYPES[path.extname(target)] ?? 'application/octet-stream',
    });
    fs.createReadStream(target).pipe(res);
  })
  .listen(port, '127.0.0.1');
