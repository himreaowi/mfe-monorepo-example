// @ts-check
/**
 * Static checks of the deploy/ templates (there is no nginx/docker in the unit test run) and of
 * validate-manifest. The image itself is built by DevOps; see docs/devops-handoff.md.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { validateManifestFile } from '../src/manifest.js';
import { app, cleanupWorkspaces, entry, makeWorkspace } from './fixture.js';

after(cleanupWorkspaces);

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
    assert.ok(vars.size >= 8);
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
      '= /mfe-manifest.json',
      '= /index.html',
      '/',
      '~ ^/(mf-manifest\\.json|mf-stats\\.json|remoteEntry\\.js)$',
      '~ ^/(service-worker\\.js|manifest\\.webmanifest)$',
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
    assert.match(location('/').body, /try_files \$uri \/index\.html;/);
    assert.match(location('= /mfe-manifest.json').body, /root \/etc\/mfe;/);
    assert.match(conf, /"~\$\{MFE_CORS_ORIGINS_REGEX\}" \$http_origin;/);
    assert.doesNotMatch(conf, /Access-Control-Allow-Origin "\*"/);
    assert.match(location('~* \\.map$').body, /return 404;/);
  });

  it('CSP: placeholders for remotes, BFF, APIs, vendors; no unsafe-eval', () => {
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
      'CSP_BFF_ORIGINS',
      'CSP_API_ORIGINS',
      'CSP_VENDOR_ORIGINS',
      'CSP_FRAME_SRC',
    ]) {
      assert.ok(csp.includes(`\${${v}}`), v);
    }
    assert.doesNotMatch(csp, /unsafe-eval/);
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
      /COPY --from=build \/out \/usr\/share\/nginx\/html/,
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
        'intranet/shell-intranet': app('shell', { type: 'shell', port: 3100 }),
        'intranet/staff': app('staff', { port: 3101 }),
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
