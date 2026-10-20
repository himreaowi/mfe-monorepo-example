// @ts-check
/**
 * The zone's local dev proxy (`pnpm dev:<zone>` starts it on the zone's proxy port, 3100 /
 * 3200): one origin for every shell of the zone, like the production reverse proxy.
 *
 * - a request goes to the shell whose base path (`mfe.basePath`) is the longest prefix of its
 *   path (`/citizen`, `/citizen/…`); the shell at `/` (if any) takes everything else;
 * - `/` redirects to the zone's default shell (root package.json
 *   `mfe.zones.<zone>.defaultShell`) when no shell sits at `/`;
 * - HTTP and WebSocket upgrades (the shells' HMR sockets live below their base path,
 *   `<basePath>/ws`) are forwarded unchanged, so the shell dev servers' strict CSP and every
 *   header pass through (the page's origin is the proxy; remotes and tools stay on their own
 *   localhost ports, which the dev CSP allows).
 * - `<basePath>/api/…` and `<basePath>/auth/…` (`/api`, `/auth` for the shell at `/`) are the
 *   same-origin proxy of production (deploy/nginx): the prefix is stripped and the rest goes to
 *   the shell's `API_UPSTREAM` / `AUTH_UPSTREAM` (from the zone/shell `.env`, src/env.js; the
 *   API default is the zone's mock API; no default for auth, dev uses the mock sign-in). The
 *   browser therefore only ever talks to the proxy origin, in dev as in production.
 * No dependency: node:http + node:https + node:net.
 */
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import path from 'node:path';
import { loadShellEnv } from './env.js';
import { loadApps } from './workspace.js';
import {
  SHELL_DIR_PREFIX,
  ZONES,
  readZoneSettings,
  shellBasePath,
  toolPort,
} from './zones.js';

/**
 * @typedef {{ name: string, packageName: string, dir: string, port: number, basePath: string }} ZoneShell
 */

/**
 * The shells of a zone (folders apps/<zone>/shell-<name> tagged type:shell with a port).
 * @param {string} root
 * @param {string} zone
 * @returns {ZoneShell[]}
 */
export function zoneShells(root, zone) {
  return loadApps(root)
    .filter((app) => {
      const tags = Array.isArray(app.pkg.nx?.tags) ? app.pkg.nx.tags : [];
      return tags.includes(`zone:${zone}`) && tags.includes('type:shell');
    })
    .filter((app) => Number.isInteger(app.pkg.mfe?.port))
    .map((app) => ({
      name: path.basename(app.dir).replace(SHELL_DIR_PREFIX, ''),
      packageName: app.name,
      dir: app.dir,
      port: app.pkg.mfe.port,
      basePath: shellBasePath(app.pkg.mfe?.basePath),
    }));
}

/** Request timeout towards an API / auth upstream (nginx: proxy_read_timeout). */
const UPSTREAM_TIMEOUT_MS = 60_000;

/**
 * The upstreams of a shell's `<base>/api` and `<base>/auth`: `API_UPSTREAM` / `AUTH_UPSTREAM`
 * from the environment and .env files (src/env.js); `api` defaults to the zone's mock API.
 * @param {string} root
 * @param {string} zone
 * @param {ZoneShell} shell
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ api?: string, auth?: string }}
 */
export function shellUpstreams(root, zone, shell, env = process.env) {
  const { values } = loadShellEnv({
    root,
    zone,
    shellDir: path.join(root, shell.dir),
    env,
  });
  /** @type {string | undefined} */
  let api = values.API_UPSTREAM?.trim();
  if (!api) {
    try {
      api = `http://localhost:${toolPort(/** @type {keyof typeof ZONES} */ (zone), 'mockApi', root)}/api`;
    } catch {
      api = undefined;
    }
  }
  return { api, auth: values.AUTH_UPSTREAM?.trim() || undefined };
}

/**
 * Is `pathname` below `<prefix>`? (`/citizen/api`, `/citizen/api/x`; not `/citizen/apis`)
 * @param {string} pathname
 * @param {string} prefix
 */
function below(pathname, prefix) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Forward a request to an upstream URL like nginx `proxy_pass <upstream>/;` does: `rest` (the
 * path below the stripped prefix) is appended to the upstream's own path. Cookies and every other
 * header pass; Host becomes the upstream's, X-Forwarded-* describe the browser's request.
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {{ upstream: string, rest: string, query: string, prefix: string, label: string }} target
 */
function forwardToUpstream(req, res, target) {
  const { upstream, rest, query, prefix, label } = target;
  let url;
  try {
    url = new URL(upstream);
  } catch {
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`${label} is not a valid URL: ${upstream}\n`);
    return;
  }
  const client = url.protocol === 'https:' ? https : http;
  const forwardedFor = [
    req.headers['x-forwarded-for'],
    req.socket.remoteAddress,
  ]
    .filter(Boolean)
    .join(', ');
  const outgoing = client.request(
    {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || undefined,
      method: req.method,
      path: `${url.pathname.replace(/\/+$/, '')}${rest}${query}`,
      headers: {
        ...req.headers,
        host: url.host,
        'x-forwarded-for': forwardedFor,
        'x-forwarded-proto': req.headers['x-forwarded-proto'] ?? 'http',
        'x-forwarded-host': req.headers.host,
        'x-forwarded-prefix': prefix,
      },
      timeout: UPSTREAM_TIMEOUT_MS,
    },
    (upRes) => {
      res.writeHead(upRes.statusCode ?? 502, {
        ...upRes.headers,
        'cache-control': 'no-store',
      });
      upRes.pipe(res);
    },
  );
  outgoing.on('timeout', () => outgoing.destroy(new Error('timed out')));
  outgoing.on('error', (error) => {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`${label} (${upstream}) did not answer: ${error.message}\n`);
  });
  req.pipe(outgoing);
}

/**
 * Where `/` of the zone goes: the shell at `/`, else the configured default shell, else the
 * only shell. `undefined` when the zone has no shell.
 * @param {ZoneShell[]} shells
 * @param {{ defaultShell?: unknown } | undefined} settings
 * @returns {ZoneShell | undefined}
 */
export function defaultShell(shells, settings) {
  return (
    shells.find((s) => s.basePath === '/') ??
    shells.find((s) => s.name === settings?.defaultShell) ??
    (shells.length === 1 ? shells[0] : undefined)
  );
}

/**
 * The shell that serves a path: longest base path that is the path or a prefix of it.
 * @param {ZoneShell[]} shells
 * @param {string} pathname
 * @returns {ZoneShell | undefined}
 */
export function routeShell(shells, pathname) {
  let best;
  for (const shell of shells) {
    const base = shell.basePath;
    const match =
      base === '/' ||
      pathname === base ||
      pathname.startsWith(`${base}/`) ||
      pathname.startsWith(`${base}?`);
    if (match && (!best || base.length > best.basePath.length)) best = shell;
  }
  return best;
}

/**
 * @param {{
 *   root: string,
 *   zone: string,
 *   port?: number,
 *   host?: string,
 *   log?: (line: string) => void,
 *   env?: NodeJS.ProcessEnv,
 * }} options
 * @returns {Promise<{ server: http.Server, shells: ZoneShell[], port: number, close: () => Promise<void> }>}
 */
export async function startZoneProxy(options) {
  const { root, zone, host = 'localhost', log = () => {} } = options;
  const range = ZONES[/** @type {keyof typeof ZONES} */ (zone)];
  if (!range) throw new Error(`zone-proxy: unknown zone "${zone}"`);
  const port = options.port ?? range.proxy;
  const shells = zoneShells(root, zone);
  const settings = readZoneSettings(root)[zone];
  const home = defaultShell(shells, settings);
  /** @type {Map<string, { api?: string, auth?: string }>} */
  const upstreams = new Map(
    shells.map((s) => [
      s.packageName,
      shellUpstreams(root, zone, s, options.env),
    ]),
  );

  const server = http.createServer((req, res) => {
    const url = req.url ?? '/';
    const pathname = url.split('?')[0];
    const shell = routeShell(shells, pathname);
    if (!shell) {
      if (pathname === '/' && home) {
        res.writeHead(302, { Location: `${home.basePath}/` });
        res.end();
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(
        `No ${zone} shell serves ${pathname}. Shells: ${
          shells.map((s) => `${s.basePath} (${s.packageName})`).join(', ') ||
          'none'
        }.\n`,
      );
      return;
    }
    // same-origin API / sign-in proxy of the shell (nginx does this in production)
    const stem = shell.basePath === '/' ? '' : shell.basePath;
    for (const [segment, variable] of /** @type {const} */ ([
      ['api', 'API_UPSTREAM'],
      ['auth', 'AUTH_UPSTREAM'],
    ])) {
      const prefix = `${stem}/${segment}`;
      if (!below(pathname, prefix)) continue;
      const target = upstreams.get(shell.packageName)?.[segment];
      if (!target) {
        res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(
          segment === 'auth'
            ? `${prefix}: no ${variable} for ${shell.packageName} (dev uses the mock sign-in; set ${variable} in the shell's or the zone's .env to proxy a BFF).\n`
            : `${prefix}: no ${variable} for ${shell.packageName} and the zone has no mock API (set ${variable} in the shell's or the zone's .env).\n`,
        );
        return;
      }
      const query = url.includes('?') ? url.slice(url.indexOf('?')) : '';
      forwardToUpstream(req, res, {
        upstream: target,
        rest: pathname.slice(prefix.length),
        query,
        prefix,
        label: variable,
      });
      return;
    }
    const upstream = http.request(
      {
        host: 'localhost',
        port: shell.port,
        method: req.method,
        path: url,
        headers: req.headers,
      },
      (upRes) => {
        res.writeHead(upRes.statusCode ?? 502, upRes.headers);
        upRes.pipe(res);
      },
    );
    upstream.on('error', (error) => {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(
        `${shell.packageName} (localhost:${shell.port}) is not answering yet: ${error.message}\n`,
      );
    });
    req.pipe(upstream);
  });

  // WebSockets (HMR): replay the upgrade request to the shell, then pipe both ways
  server.on('upgrade', (req, socket, head) => {
    const url = req.url ?? '/';
    const shell = routeShell(shells, url.split('?')[0]);
    if (!shell) {
      socket.destroy();
      return;
    }
    const upstream = net.connect(shell.port, 'localhost', () => {
      const lines = [`${req.method} ${url} HTTP/${req.httpVersion}`];
      for (let i = 0; i < req.rawHeaders.length; i += 2) {
        lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
      }
      upstream.write(`${lines.join('\r\n')}\r\n\r\n`);
      if (head?.length) upstream.write(head);
      upstream.pipe(socket);
      socket.pipe(upstream);
    });
    upstream.on('error', () => socket.destroy());
    socket.on('error', () => upstream.destroy());
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve(undefined));
  });
  log(
    `${zone} dev proxy on http://localhost:${port}: ${
      shells
        .map((s) => {
          const u = upstreams.get(s.packageName);
          return `${s.basePath} → ${s.packageName} (:${s.port}; ${s.basePath === '/' ? '' : s.basePath}/api → ${u?.api ?? 'none'}${u?.auth ? `, ${s.basePath === '/' ? '' : s.basePath}/auth → ${u.auth}` : ''})`;
        })
        .join(', ') || 'no shells'
    }${home && home.basePath !== '/' ? `; / → ${home.basePath}/` : ''}`,
  );
  return {
    server,
    shells,
    port,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      }),
  };
}
