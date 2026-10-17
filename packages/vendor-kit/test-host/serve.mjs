#!/usr/bin/env node
// Serves the vendor kit folder for the test host (ES modules need http://, not file://).
//   node test-host/serve.mjs [--port 3998]
// then open http://localhost:3998/test-host/?url=<your bundle URL>&format=esm
// Your bundle's server must send CORS headers (Access-Control-Allow-Origin) for this origin.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: { port: { type: 'string', default: '3998' } },
});
const port = Number(values.port);
const root = path.resolve(import.meta.dirname, '..');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.ts': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`);
    let file = path.join(root, decodeURIComponent(url.pathname));
    if (!file.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory())
      file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type':
        TYPES[/** @type {keyof typeof TYPES} */ (path.extname(file))] ??
        'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    });
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, () => {
    console.log(`vendor kit test host: http://localhost:${port}/test-host/`);
    console.log(
      `  example: http://localhost:${port}/test-host/?url=http://localhost:${port}/examples/vanilla/mount.js&format=esm&autoMount=1`,
    );
  });
