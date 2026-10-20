// @ts-check
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import {
  defaultShell,
  routeShell,
  startZoneProxy,
  zoneShells,
} from '../src/zone-proxy.js';
import { app, cleanupWorkspaces, makeWorkspace } from './fixture.js';

after(cleanupWorkspaces);

/** @param {http.Server} server @returns {Promise<number>} */
const listen = (server) =>
  new Promise((resolve) => {
    server.listen(0, 'localhost', () =>
      resolve(/** @type {net.AddressInfo} */ (server.address()).port),
    );
  });

/** @param {string} name @returns {http.Server} upstream that echoes who answered */
const upstream = (name) =>
  http.createServer((req, res) => {
    res.setHeader('Content-Security-Policy', "default-src 'self'");
    res.end(`${name} ${req.url}`);
  });

/** @param {string} url */
async function get(url) {
  const res = await fetch(url, { redirect: 'manual' });
  return {
    status: res.status,
    location: res.headers.get('location'),
    csp: res.headers.get('content-security-policy'),
    body: await res.text(),
  };
}

describe('zone dev proxy', () => {
  const shells = [
    {
      name: 'citizen',
      packageName: 'c',
      dir: '',
      port: 1,
      basePath: '/citizen',
    },
    {
      name: 'business',
      packageName: 'b',
      dir: '',
      port: 2,
      basePath: '/business',
    },
  ];

  it('routes by the longest base path; "/" is the fallback shell', () => {
    assert.equal(routeShell(shells, '/citizen')?.name, 'citizen');
    assert.equal(routeShell(shells, '/citizen/a/b')?.name, 'citizen');
    assert.equal(routeShell(shells, '/citizenship'), undefined);
    assert.equal(routeShell(shells, '/'), undefined);
    const withRoot = [
      ...shells,
      { name: 'main', packageName: 'm', dir: '', port: 3, basePath: '/' },
    ];
    assert.equal(routeShell(withRoot, '/x')?.name, 'main');
    assert.equal(routeShell(withRoot, '/business/x')?.name, 'business');
    assert.equal(defaultShell(withRoot, {})?.name, 'main');
    assert.equal(
      defaultShell(shells, { defaultShell: 'business' })?.name,
      'business',
    );
    assert.equal(defaultShell(shells, {}), undefined);
  });

  it('forwards HTTP (headers kept) and WebSocket upgrades, redirects "/"', async () => {
    const citizen = upstream('citizen');
    const business = upstream('business');
    business.on('upgrade', (req, socket) => {
      socket.write(
        'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n',
      );
      socket.write(`ws ${req.url}`);
      socket.end();
    });
    const [cPort, bPort] = [await listen(citizen), await listen(business)];
    const root = makeWorkspace({
      apps: {
        'internet/shell-citizen': {
          ...app('shell', { zone: 'internet', type: 'shell', port: cPort }),
          name: '@org/shell-citizen',
          mfe: { port: cPort, federationName: 'c', basePath: '/citizen' },
        },
        'internet/shell-business': {
          ...app('shell', { zone: 'internet', type: 'shell', port: bPort }),
          name: '@org/shell-business',
          mfe: { port: bPort, federationName: 'b', basePath: '/business' },
        },
      },
      rootMfe: { zones: { internet: { defaultShell: 'citizen' } } },
    });
    assert.deepEqual(
      zoneShells(root, 'internet')
        .map((s) => s.name)
        .sort(),
      ['business', 'citizen'],
    );
    const proxy = await startZoneProxy({ root, zone: 'internet', port: 0 });
    const port = /** @type {net.AddressInfo} */ (proxy.server.address()).port;
    try {
      const base = `http://localhost:${port}`;
      let r = await get(`${base}/citizen/main.js?x=1`);
      assert.equal(r.body, 'citizen /citizen/main.js?x=1');
      assert.equal(r.csp, "default-src 'self'");
      r = await get(`${base}/business`);
      assert.equal(r.body, 'business /business');
      r = await get(`${base}/`);
      assert.equal(r.status, 302);
      assert.equal(r.location, '/citizen/');
      r = await get(`${base}/elsewhere`);
      assert.equal(r.status, 404);

      const text = await new Promise((resolve, reject) => {
        const socket = net.connect(port, 'localhost', () => {
          socket.write(
            'GET /business/ws HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n',
          );
        });
        let data = '';
        socket.on('data', (chunk) => {
          data += chunk;
        });
        socket.on('end', () => resolve(data));
        socket.on('error', reject);
      });
      assert.match(String(text), /101 Switching Protocols/);
      assert.match(String(text), /ws \/business\/ws/);
    } finally {
      await proxy.close();
      citizen.close();
      business.close();
    }
  });

  it('answers 502 while a shell is not up yet', async () => {
    const root = makeWorkspace({
      apps: {
        'intranet/shell-intranet': app('shell', { type: 'shell', port: 1 }),
      },
    });
    const proxy = await startZoneProxy({ root, zone: 'intranet', port: 0 });
    const port = /** @type {net.AddressInfo} */ (proxy.server.address()).port;
    try {
      const r = await get(`http://localhost:${port}/anything`);
      assert.equal(r.status, 502);
    } finally {
      await proxy.close();
    }
  });

  it('proxies <base>/api and <base>/auth to the .env upstreams, same origin, cookies kept', async () => {
    /** @type {http.IncomingHttpHeaders[]} */
    const seen = [];
    const api = http.createServer((req, res) => {
      seen.push(req.headers);
      res.setHeader('Set-Cookie', 'sid=1; Path=/');
      res.end(`api ${req.method} ${req.url}`);
    });
    const auth = http.createServer((req, res) => {
      res.end(`auth ${req.url}`);
    });
    const shellServer = upstream('citizen');
    const [aPort, bPort, sPort] = [
      await listen(api),
      await listen(auth),
      await listen(shellServer),
    ];
    const root = makeWorkspace({
      apps: {
        'internet/shell-citizen': {
          ...app('shell', { zone: 'internet', type: 'shell', port: sPort }),
          name: '@org/shell-citizen',
          mfe: { port: sPort, federationName: 'c', basePath: '/citizen' },
        },
        'internet/shell-business': {
          ...app('shell', { zone: 'internet', type: 'shell', port: 1 }),
          name: '@org/shell-business',
          mfe: { port: 1, federationName: 'b', basePath: '/business' },
        },
      },
    });
    // zone .env (both shells) + shell .env override (business has no API at all)
    fs.writeFileSync(
      path.join(root, 'apps/internet/.env'),
      `API_UPSTREAM=http://localhost:${aPort}/v1/\nAUTH_UPSTREAM=http://localhost:${bPort}\n`,
    );
    fs.writeFileSync(
      path.join(root, 'apps/internet/shell-business/.env'),
      'API_UPSTREAM=\n',
    );
    const proxy = await startZoneProxy({
      root,
      zone: 'internet',
      port: 0,
      env: {},
    });
    const port = /** @type {net.AddressInfo} */ (proxy.server.address()).port;
    const base = `http://localhost:${port}`;
    try {
      const res = await fetch(`${base}/citizen/api/leave?a=1`, {
        method: 'POST',
        headers: { cookie: 'sid=abc', 'x-csrf-token': 't' },
        body: '{}',
      });
      assert.equal(await res.text(), 'api POST /v1/leave?a=1');
      assert.equal(res.headers.get('cache-control'), 'no-store');
      assert.equal(res.headers.get('set-cookie'), 'sid=1; Path=/');
      assert.equal(seen[0].cookie, 'sid=abc');
      assert.equal(seen[0]['x-csrf-token'], 't');
      assert.equal(seen[0].host, `localhost:${aPort}`);
      assert.equal(seen[0]['x-forwarded-host'], `localhost:${port}`);
      assert.equal(seen[0]['x-forwarded-proto'], 'http');
      assert.equal(seen[0]['x-forwarded-prefix'], '/citizen/api');
      assert.match(String(seen[0]['x-forwarded-for']), /127\.0\.0\.1|::1/);

      let r = await get(`${base}/citizen/auth/session`);
      assert.equal(r.body, 'auth /session');
      // a look-alike path is the shell's own page, not the API
      r = await get(`${base}/citizen/apis`);
      assert.equal(r.body, 'citizen /citizen/apis');
      // empty API_UPSTREAM in the shell's .env overrides the zone's: nothing to proxy to
      r = await get(`${base}/business/api/x`);
      assert.equal(r.status, 502);
      assert.match(r.body, /API_UPSTREAM/);
    } finally {
      await proxy.close();
      api.close();
      auth.close();
      shellServer.close();
    }
  });

  it('real environment beats the shell .env, which beats the zone .env', async () => {
    const { loadShellEnv } = await import('../src/env.js');
    const root = makeWorkspace({
      apps: {
        'internet/shell-citizen': app('shell', {
          zone: 'internet',
          type: 'shell',
          port: 1,
        }),
      },
    });
    const shellDir = path.join(root, 'apps/internet/shell-citizen');
    fs.writeFileSync(
      path.join(root, 'apps/internet/.env'),
      'API_UPSTREAM=zone\nAUTH_UPSTREAM=zone\nOTHER=zone\n',
    );
    fs.writeFileSync(
      path.join(shellDir, '.env'),
      'API_UPSTREAM=shell\nOTHER=shell\n',
    );
    const { values } = loadShellEnv({
      root,
      zone: 'internet',
      shellDir,
      env: { AUTH_UPSTREAM: 'real', OTHER: 'real' },
    });
    assert.deepEqual(values, {
      API_UPSTREAM: 'shell',
      AUTH_UPSTREAM: 'real',
      OTHER: 'real',
    });
  });
});
