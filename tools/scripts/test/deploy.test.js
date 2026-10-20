// @ts-check
/**
 * Static checks of the deploy/ templates (there is no nginx/docker in the unit test run) and of
 * validate-manifest. The image itself is built by DevOps; see docs/devops-handoff.md.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { validateManifestFile } from '../src/manifest.js';
import { app, cleanupWorkspaces, entry, makeWorkspace } from './fixture.js';
import { ENV_VARIABLES } from '../src/env.js';

after(cleanupWorkspaces);

/** deploy/write-shell-env.mjs (a build script outside any package) */
const { shellEnv } = /** @type {{ shellEnv: (dir: string) => string }} */ (
  await import(
    pathToFileURL(
      path.resolve(import.meta.dirname, '../../../deploy/write-shell-env.mjs'),
    ).href
  )
);

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const read = (/** @type {string} */ rel) =>
  fs.readFileSync(path.join(ROOT, rel), 'utf8');
const conf = read('deploy/nginx/default.conf.template');
const headers = read('deploy/nginx/security-headers.inc.template');
const dockerfile = read('deploy/Dockerfile');

/** `location <match> { ... }` blocks (no nested blocks in our template). */
function locations() {
  return [
    ...conf.matchAll(/^\s*location\s+(.+?)\s*\{\s*$([\s\S]*?)^\s*\}/gm),
  ].map((m) => ({
    match: m[1].trim(),
    body: m[2],
  }));
}
/** @param {string} match */
const location = (match) => {
  const found = locations().find((l) => l.match === match);
  assert.ok(found, `location ${match}`);
  return found;
};

describe('deploy/nginx templates', () => {
  it('every ${VAR} has a default in the Dockerfile (envsubst leaves unset ones in place)', () => {
    const vars = new Set(
      [...`${conf}\n${headers}`.matchAll(/\$\{([A-Z0-9_]+)\}/g)].map(
        (m) => m[1],
      ),
    );
    assert.ok(vars.size >= 7);
    const envBlock = dockerfile.slice(dockerfile.indexOf('ENV NGINX_PORT'));
    for (const v of vars) {
      assert.match(envBlock, new RegExp(`\\b${v}=`), `${v} default in ENV`);
    }
  });

  it('every location with add_header repeats the security headers (no add_header inheritance)', () => {
    for (const loc of locations()) {
      if (!loc.body.includes('add_header')) continue;
      assert.ok(
        loc.body.includes('include /etc/nginx/conf.d/security-headers.inc;'),
        `location ${loc.match} includes the security headers`,
      );
    }
  });

  it('caching: no-cache for index.html and manifests/entries, immutable for hashed files', () => {
    for (const match of [
      '~ ^/(?:[a-z0-9/-]+/)?mfe-manifest\\.json$',
      '= /index.html',
      '/',
      '~ /(mf-manifest\\.json|mf-stats\\.json|remoteEntry\\.js)$',
      '~ /(service-worker\\.js|manifest\\.webmanifest)$',
    ]) {
      assert.match(location(match).body, /Cache-Control "no-cache"/, match);
    }
    const hashed = location('~* \\.[0-9a-f]{8}\\.(?:js|mjs|css)$');
    assert.match(hashed.body, /max-age=31536000, immutable/);
    const re = /\.[0-9a-f]{8}\.(?:js|mjs|css)$/i;
    for (const f of [
      'main.f0dd8b37.js',
      '118.3b298b8a.js',
      '__federation_expose_App.6b3d4dc8.js',
      // extracted CSS ([name].[contenthash:8].css from @org/rspack-config)
      '__federation_expose_App.f1c5d0e3.css',
      '735.dd49997c.css',
    ]) {
      assert.match(f, re);
    }
    for (const f of [
      'remoteEntry.js',
      'service-worker.js',
      'mf-manifest.json',
    ]) {
      assert.doesNotMatch(f, re);
    }
  });

  it('SPA fallback, per-env manifest from /etc/mfe, CORS from an allow-list, no source maps', () => {
    assert.match(
      location('/').body,
      /try_files \$uri \$mfe_base_path\/index\.html;/,
    );
    const manifest = '~ ^/(?:[a-z0-9/-]+/)?mfe-manifest\\.json$';
    assert.match(location(manifest).body, /root \/etc\/mfe;/);
    // the shell's manifest below its base path, before the generic *.json location
    const re = /^\/(?:[a-z0-9/-]+\/)?mfe-manifest\.json$/;
    for (const url of ['/mfe-manifest.json', '/citizen/mfe-manifest.json']) {
      assert.match(url, re);
    }
    assert.doesNotMatch('/mf-manifest.json', re);
    const order = locations().map((l) => l.match);
    assert.ok(
      order.indexOf(manifest) <
        order.findIndex((m) => m.includes('json|js|css')),
    );
    assert.match(conf, /include \/etc\/nginx\/mfe-base-path\.inc;/);
    assert.match(dockerfile, /return 302 %s\/;/);
    assert.match(conf, /"~\$\{MFE_CORS_ORIGINS_REGEX\}" \$http_origin;/);
    assert.doesNotMatch(conf, /Access-Control-Allow-Origin "\*"/);
    assert.match(location('~* \\.map$').body, /return 404;/);
  });

  it('CSP: placeholders for remotes and vendors, same-origin API; no unsafe-eval, no unsafe-inline', () => {
    const csp = /Content-Security-Policy "([^"]+)"/.exec(headers)?.[1] ?? '';
    for (const directive of [
      "default-src 'self'",
      'script-src',
      'connect-src',
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
    ]) {
      assert.ok(csp.includes(directive), directive);
    }
    for (const v of [
      'CSP_REMOTE_ORIGINS',
      'CSP_VENDOR_ORIGINS',
      'CSP_FRAME_SRC',
    ]) {
      assert.ok(csp.includes(`\${${v}}`), v);
    }
    // API and BFF are same-origin (proxied by nginx): no origin variables for them
    assert.doesNotMatch(`${csp}${dockerfile}`, /CSP_(?:API|BFF)_ORIGINS/);
    assert.match(
      csp,
      /connect-src 'self' \$\{CSP_REMOTE_ORIGINS\} \$\{CSP_VENDOR_ORIGINS\};/,
    );
    assert.match(csp, /form-action 'self';/);
    assert.doesNotMatch(csp, /unsafe-eval/);
    // production CSS is extracted into .css files: no inline styles allowed
    assert.doesNotMatch(csp, /unsafe-inline/);
    assert.match(
      csp,
      /style-src 'self' \$\{CSP_REMOTE_ORIGINS\} \$\{CSP_VENDOR_ORIGINS\};/,
    );
  });

  it('Dockerfile: one app per build arg, pnpm filter, frozen lockfile, non-root nginx', () => {
    assert.match(dockerfile, /^ARG APP$/m);
    assert.match(
      dockerfile,
      /pnpm install --frozen-lockfile --offline --filter "\$\{APP\}\.\.\."/,
    );
    assert.match(dockerfile, /pnpm --filter "\$\{APP\}" run build/);
    assert.match(dockerfile, /^USER 101$/m);
    assert.match(
      dockerfile,
      /COPY --from=build \/out\/html \/usr\/share\/nginx\/html/,
    );
  });
});

describe('validate-manifest', () => {
  it('accepts the example per-environment manifest', async () => {
    const result = await validateManifestFile({
      root: ROOT,
      file: path.join(ROOT, 'deploy/mfe-manifest.example.json'),
    });
    assert.deepEqual(result, { errors: [], warnings: [] });
  });

  /** @param {unknown} manifest @param {string} [zone] */
  async function check(manifest, zone) {
    const root = makeWorkspace({
      apps: {
        'intranet/shell-intranet': app('shell', { type: 'shell', port: 3101 }),
        'intranet/staff': app('staff', { port: 3111 }),
      },
      files: {
        'apps/intranet/shell-intranet/remotes.json': {
          remotes: [entry('intranet', 'staff')],
        },
        'm.json': /** @type {object} */ (manifest),
      },
    });
    fs.mkdirSync(path.join(root, path.dirname(VALIDATOR)), { recursive: true });
    fs.copyFileSync(path.join(ROOT, VALIDATOR), path.join(root, VALIDATOR));
    return validateManifestFile({
      root,
      file: path.join(root, 'm.json'),
      zone,
    });
  }
  const VALIDATOR =
    'packages/mf-runtime/src/manifest/validateSchema.generated.js';

  it('several shells in a zone: --shell picks whose remotes.json applies', async () => {
    const root = makeWorkspace({
      apps: {
        'internet/shell-citizen': app('shell', {
          zone: 'internet',
          type: 'shell',
          port: 3201,
        }),
        'internet/shell-business': app('shell', {
          zone: 'internet',
          type: 'shell',
          port: 3202,
        }),
        'internet/services': app('services', { zone: 'internet', port: 3211 }),
      },
      files: {
        'apps/internet/shell-citizen/remotes.json': {
          remotes: [entry('internet', 'services')],
        },
        'apps/internet/shell-business/remotes.json': { remotes: [] },
        'm.json': { remotes: {} },
      },
    });
    fs.mkdirSync(path.join(root, path.dirname(VALIDATOR)), { recursive: true });
    fs.copyFileSync(path.join(ROOT, VALIDATOR), path.join(root, VALIDATOR));
    const run = (/** @type {string | undefined} */ shell) =>
      validateManifestFile({
        root,
        file: path.join(root, 'm.json'),
        zone: 'internet',
        shell,
      });
    assert.match(
      (await run(undefined)).errors[0].message,
      /pass --shell=<name>/,
    );
    assert.deepEqual((await run('business')).errors, []);
    assert.deepEqual(
      (await run('citizen')).errors.map((e) => e.rule),
      ['remote-missing'],
    );
  });

  it('schema errors, mock auth, http entries', async () => {
    let r = await check({ remotes: {}, extra: 1 });
    assert.deepEqual(
      r.errors.map((e) => e.rule),
      ['schema'],
    );
    assert.match(r.errors[0].message, /extra/);
    r = await check({ remotes: {}, auth: { mock: true } });
    assert.deepEqual(
      r.errors.map((e) => e.rule),
      ['auth-mock'],
    );
    r = await check({
      remotes: {
        intranet_staff: { entry: 'http://cdn.example.sg/mf-manifest.json' },
      },
    });
    assert.deepEqual(
      r.errors.map((e) => e.rule),
      ['https'],
    );
  });

  it('--zone: registered remotes must be listed, unknown ones are warnings', async () => {
    let r = await check(
      { remotes: { intranet_other: { entry: '/o/mf-manifest.json' } } },
      'intranet',
    );
    assert.deepEqual(
      r.errors.map((e) => e.rule),
      ['remote-missing'],
    );
    assert.deepEqual(
      r.warnings.map((e) => e.rule),
      ['remote-unknown'],
    );
    r = await check(
      {
        remotes: {
          intranet_staff: { entry: 'https://s.example.sg/mf-manifest.json' },
        },
      },
      'intranet',
    );
    assert.deepEqual(r, { errors: [], warnings: [] });
  });
});

// --- same-origin /api and /auth proxy, manifest from variables -----------------------------------
const script = path.join(ROOT, 'deploy/docker-entrypoint.d/40-mfe-manifest.sh');

/**
 * Run the entrypoint script like the container does, in a temp dir.
 * @param {Record<string, string>} env
 * @param {string} [shellEnvText] content of mfe-shell.env ('' = a remote image)
 */
function runEntrypoint(env, shellEnvText = '') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mfe-entry-'));
  fs.writeFileSync(path.join(dir, 'shell.env'), shellEnvText);
  const result = spawnSync('sh', [script], {
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH ?? '',
      MFE_ETC_DIR: path.join(dir, 'mfe'),
      MFE_SHELL_ENV: path.join(dir, 'shell.env'),
      ...env,
    },
  });
  const file = (/** @type {string} */ name) => {
    const f = path.join(dir, 'mfe', name);
    return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : undefined;
  };
  return {
    dir,
    status: result.status,
    stderr: result.stderr,
    stdout: result.stdout,
    manifest: file('mfe-manifest.json'),
    proxy: file('mfe-proxy.inc'),
  };
}

const CITIZEN_ENV = [
  'MFE_IS_SHELL=1',
  'MFE_BASE_PATH=/citizen',
  'MFE_REMOTES="internet_services internet_payments"',
  'MFE_AUTH=1',
  '',
].join('\n');
const CITIZEN_VARS = {
  API_UPSTREAM: 'https://api.uat.example.sg/v1/',
  AUTH_UPSTREAM: 'http://bff-citizen:8080',
  REMOTE_INTERNET_SERVICES_URL: 'https://services.example.sg/mf-manifest.json',
  REMOTE_INTERNET_PAYMENTS_URL: '/payments/mf-manifest.json',
  REMOTE_INTERNET_PAYMENTS_PROPS: '{"title":"Pay"}',
  MFE_ENVIRONMENT: 'uat',
};

/** The nginx locations of a rendered include. */
function includeLocations(/** @type {string} */ text) {
  return [...text.matchAll(/^location\s+(.+?)\s*\{\s*$([\s\S]*?)^\}/gm)].map(
    (m) => ({ match: m[1].trim(), body: m[2] }),
  );
}

describe('same-origin /api and /auth (entrypoint + nginx templates)', () => {
  it('the script is valid sh', () => {
    execFileSync('sh', ['-n', script]);
  });

  it('shell: generates a manifest with relative URLs only, which validates', async () => {
    const r = runEntrypoint(CITIZEN_VARS, CITIZEN_ENV);
    assert.equal(r.status, 0, r.stderr);
    const manifest = JSON.parse(r.manifest ?? '');
    assert.deepEqual(manifest, {
      remotes: {
        internet_services: {
          entry: 'https://services.example.sg/mf-manifest.json',
        },
        internet_payments: {
          entry: '/payments/mf-manifest.json',
          props: { title: 'Pay' },
        },
      },
      auth: {
        sessionUrl: '/citizen/auth/session',
        loginUrl: '/citizen/auth/login',
        logoutUrl: '/citizen/auth/logout',
      },
      settings: { apiBaseUrl: '/citizen/api', environment: 'uat' },
    });
    // no upstream (server-side only) leaks into the browser-facing manifest
    assert.doesNotMatch(r.manifest ?? '', /api\.uat|bff-citizen/);
    const file = path.join(r.dir, 'mfe', 'mfe-manifest.json');
    assert.deepEqual(await validateManifestFile({ root: ROOT, file }), {
      errors: [],
      warnings: [],
    });
  });

  it('shell at "/": /api and /auth, auth and API optional', () => {
    const r = runEntrypoint(
      { REMOTE_X_URL: 'https://x.example.sg/mf-manifest.json' },
      'MFE_IS_SHELL=1\nMFE_BASE_PATH=\nMFE_REMOTES="x"\nMFE_AUTH=0\n',
    );
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(JSON.parse(r.manifest ?? ''), {
      remotes: { x: { entry: 'https://x.example.sg/mf-manifest.json' } },
      settings: {},
    });
    assert.match(r.stdout, /warning: API_UPSTREAM is not set/);
    // /api answers 503 instead of falling through to index.html; no /auth without sign-in
    assert.deepEqual(
      includeLocations(r.proxy ?? '').map((l) => l.match),
      ['^~ /api/'],
    );
    assert.match(r.proxy ?? '', /return 503 "\/api is not configured/);
  });

  it('proxy locations: ^~ prefix, upstream with rest of path, cookies, headers, no caching', () => {
    const r = runEntrypoint(CITIZEN_VARS, CITIZEN_ENV);
    const locations = includeLocations(r.proxy ?? '');
    assert.deepEqual(
      locations.map((l) => l.match),
      ['^~ /citizen/api/', '^~ /citizen/auth/'],
    );
    const [api, auth] = locations;
    assert.match(api.body, /proxy_pass https:\/\/api\.uat\.example\.sg\/v1\/;/);
    assert.match(
      api.body,
      /proxy_set_header X-Forwarded-Prefix \/citizen\/api;/,
    );
    assert.match(api.body, /proxy_ssl_verify on;/);
    assert.match(auth.body, /proxy_pass http:\/\/bff-citizen:8080\/;/);
    assert.doesNotMatch(auth.body, /proxy_ssl_verify/);
    for (const loc of locations) {
      assert.match(
        loc.body,
        /include \/etc\/nginx\/conf\.d\/proxy-common\.inc;/,
      );
      assert.match(loc.body, /proxy_hide_header Cache-Control;/);
      assert.match(loc.body, /add_header Cache-Control "no-store" always;/);
      assert.match(
        loc.body,
        /include \/etc\/nginx\/conf\.d\/security-headers\.inc;/,
      );
    }
    const common = read('deploy/nginx/proxy-common.inc.template');
    for (const directive of [
      /proxy_set_header Host \$proxy_host;/,
      /proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;/,
      /proxy_set_header X-Forwarded-Proto \$mfe_forwarded_proto;/,
      /proxy_set_header X-Forwarded-Host \$host;/,
      /proxy_connect_timeout \d+s;/,
      /proxy_read_timeout \d+s;/,
      /proxy_cache off;/,
    ]) {
      assert.match(common, directive);
    }
    // cookies and Authorization are not stripped
    assert.doesNotMatch(common, /proxy_set_header (Cookie|Authorization)/i);
    assert.doesNotMatch(common, /proxy_pass_header|proxy_ignore_headers/);
  });

  it('the server config includes the proxy locations before the static rules, X-Forwarded-Proto map', () => {
    assert.match(conf, /include \/etc\/mfe\/mfe-proxy\.inc;/);
    assert.match(
      conf,
      /map \$http_x_forwarded_proto \$mfe_forwarded_proto \{[^}]*"" \$scheme;/,
    );
    assert.ok(
      conf.indexOf('mfe-proxy.inc') < conf.indexOf('location = /healthz'),
    );
    // `^~` wins over the regex locations of static files (/citizen/api/x.json is an API call)
    const r = runEntrypoint(CITIZEN_VARS, CITIZEN_ENV);
    assert.ok(
      includeLocations(r.proxy ?? '').every((l) => l.match.startsWith('^~ ')),
    );
    assert.match(dockerfile, /proxy-common\.inc\.template/);
  });

  it('upstreams may be missing for a shell with auth only as a clear failure', () => {
    const r = runEntrypoint(
      { API_UPSTREAM: 'https://api.example.sg' },
      CITIZEN_ENV,
    );
    assert.equal(r.status, 1);
    assert.match(r.stderr, /REMOTE_INTERNET_SERVICES_URL is not set/);
    assert.match(r.stderr, /REMOTE_INTERNET_PAYMENTS_URL is not set/);
    assert.match(r.stderr, /AUTH_UPSTREAM is not set/);
    assert.equal(r.manifest, undefined);
  });

  it('fails fast on malformed values', () => {
    const r = runEntrypoint(
      {
        ...CITIZEN_VARS,
        API_UPSTREAM: 'api.example.sg; return 200',
        REMOTE_INTERNET_SERVICES_URL: 'http://cdn.example.sg/mf-manifest.json',
        REMOTE_INTERNET_PAYMENTS_URL: 'https://p.example.sg/index.html',
        REMOTE_INTERNET_PAYMENTS_PROPS: 'not json',
        MFE_ENVIRONMENT: 'x"y',
      },
      CITIZEN_ENV,
    );
    assert.equal(r.status, 1);
    assert.match(r.stderr, /API_UPSTREAM=.* is not a http\(s\)/);
    assert.match(r.stderr, /REMOTE_INTERNET_SERVICES_URL=.* must use https/);
    assert.match(
      r.stderr,
      /REMOTE_INTERNET_PAYMENTS_URL=.* ending in \.json or \.js/,
    );
    assert.match(r.stderr, /MFE_ENVIRONMENT=/);
    assert.equal(r.manifest, undefined);
  });

  it('MFE_MANIFEST_JSON is still used as is (no generation), proxy only for configured upstreams', () => {
    const json = '{"remotes":{}}';
    const r = runEntrypoint({ MFE_MANIFEST_JSON: json }, CITIZEN_ENV);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.manifest, `${json}\n`);
    assert.equal(
      includeLocations(r.proxy ?? '').length,
      0,
      'no API_UPSTREAM, no location',
    );
    const withApi = runEntrypoint(
      { MFE_MANIFEST_JSON: json, API_UPSTREAM: 'http://api:9000' },
      CITIZEN_ENV,
    );
    assert.deepEqual(
      includeLocations(withApi.proxy ?? '').map((l) => l.match),
      ['^~ /citizen/api/'],
    );
  });

  it('a remote image gets no manifest and an empty proxy include', () => {
    const r = runEntrypoint({}, shellEnv(remoteDir()));
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.manifest, undefined);
    assert.equal(r.proxy, '');
  });

  it('write-shell-env: base path, registered remotes, auth of a shell', () => {
    const root = makeWorkspace({
      apps: {
        'internet/shell-citizen': app('shell', {
          zone: 'internet',
          type: 'shell',
          port: 3201,
          extra: {
            mfe: {
              port: 3201,
              federationName: 'internet_shell',
              basePath: '/citizen/',
              devManifest: { auth: { mock: true } },
            },
          },
        }),
        'internet/shell-plain': app('shell', {
          zone: 'internet',
          type: 'shell',
          port: 3202,
        }),
      },
      files: {
        'apps/internet/shell-citizen/remotes.json': {
          remotes: [
            entry('internet', 'services'),
            entry('internet', 'pay-ments'),
          ],
        },
      },
    });
    assert.equal(
      shellEnv(path.join(root, 'apps/internet/shell-citizen')),
      'MFE_IS_SHELL=1\nMFE_BASE_PATH=/citizen\nMFE_REMOTES="internet_services internet_pay_ments"\nMFE_AUTH=1\n',
    );
    assert.equal(
      shellEnv(path.join(root, 'apps/internet/shell-plain')),
      'MFE_IS_SHELL=1\nMFE_BASE_PATH=\nMFE_REMOTES=""\nMFE_AUTH=0\n',
    );
  });

  it('every Dockerfile ENV variable is a documented ENV_VARIABLES entry (check-env keeps .env.example in sync)', () => {
    const envBlock = dockerfile.slice(dockerfile.indexOf('ENV NGINX_PORT'));
    const names = [
      ...envBlock.matchAll(/^\s*(?:ENV\s+)?([A-Z][A-Z0-9_]*)=/gm),
    ].map((m) => m[1]);
    assert.ok(names.length >= 8);
    for (const name of names) {
      assert.ok(
        name in ENV_VARIABLES,
        `${name} missing from ENV_VARIABLES (src/env.js)`,
      );
    }
    for (const name of Object.keys(ENV_VARIABLES)) {
      assert.ok(names.includes(name) || name === 'MFE_MANIFEST_JSON', name);
    }
  });

  it('validate-manifest warns about absolute API / sign-in URLs', async () => {
    const root = makeWorkspace({
      files: {
        'm.json': {
          remotes: {},
          settings: { apiBaseUrl: 'https://api.example.sg/api' },
        },
      },
    });
    fs.mkdirSync(path.join(root, 'packages/mf-runtime/src/manifest'), {
      recursive: true,
    });
    fs.copyFileSync(
      path.join(
        ROOT,
        'packages/mf-runtime/src/manifest/validateSchema.generated.js',
      ),
      path.join(
        root,
        'packages/mf-runtime/src/manifest/validateSchema.generated.js',
      ),
    );
    const r = await validateManifestFile({
      root,
      file: path.join(root, 'm.json'),
    });
    assert.deepEqual(r.errors, []);
    assert.deepEqual(
      r.warnings.map((w) => w.rule),
      ['same-origin'],
    );
  });
});

/** A throwaway remote app dir (type:remote). */
function remoteDir() {
  const root = makeWorkspace({
    apps: { 'intranet/staff': app('staff', { port: 3111 }) },
  });
  return path.join(root, 'apps/intranet/staff');
}
