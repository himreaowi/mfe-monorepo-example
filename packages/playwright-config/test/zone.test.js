// @ts-check
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { createZoneConfig } from '../src/index.js';
import { formatViolations } from '../src/test.js';
import {
  findWorkspaceRoot,
  isMockVendor,
  loadZone,
  waitForUrls,
} from '../src/zone.js';

/** @type {string[]} */
const created = [];
after(() => {
  for (const dir of created) fs.rmSync(dir, { recursive: true, force: true });
});

/** Fake workspace with one shell (like `pnpm gen:shell intranet` + two gen:remote). */
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mfe-pw-'));
  created.push(root);
  fs.writeFileSync(path.join(root, 'pnpm-workspace.yaml'), 'packages: []\n');
  const shellDir = path.join(root, 'apps', 'intranet', 'shell-intranet');
  fs.mkdirSync(shellDir, { recursive: true });
  const write = (/** @type {string} */ f, /** @type {unknown} */ v) =>
    fs.writeFileSync(path.join(shellDir, f), JSON.stringify(v));
  write('package.json', {
    name: '@org/shell-intranet',
    nx: { tags: ['zone:intranet', 'type:shell', 'access:public'] },
    mfe: { port: 3100, federationName: 'intranet_shell' },
  });
  write('remotes.json', {
    remotes: [
      {
        name: 'staff',
        title: 'Staff',
        path: '/staff',
        federationName: 'intranet_staff',
        package: '@org/intranet-staff',
        access: 'private',
        kind: 'react',
      },
      {
        name: 'helpdesk',
        title: 'Helpdesk',
        path: '/helpdesk',
        federationName: 'intranet_helpdesk',
        package: '@org/intranet-helpdesk',
        access: 'public',
        kind: 'external',
      },
    ],
  });
  write('mfe-manifest.dev.json', {
    remotes: {
      intranet_staff: { entry: 'http://localhost:3101/mf-manifest.json' },
      intranet_helpdesk: {
        entry: 'http://localhost:3102/mf-manifest.json',
        props: {
          vendor: { url: 'http://localhost:3999/mount.js', format: 'esm' },
        },
      },
    },
    auth: { mock: true },
  });
  return { root, shellDir };
}

describe('loadZone', () => {
  it('reads port, registry and dev manifest', () => {
    const { shellDir } = fixture();
    const zone = loadZone(shellDir);
    assert.equal(zone.zone, 'intranet');
    assert.equal(zone.shellUrl, 'http://localhost:3100');
    assert.equal(zone.authMock, true);
    assert.deepEqual(
      zone.remotes.map((r) => [r.name, r.origin, r.access, r.mockVendor]),
      [
        ['staff', 'http://localhost:3101', 'private', false],
        ['helpdesk', 'http://localhost:3102', 'public', true],
      ],
    );
    assert.equal(zone.remotes[0].standaloneUrl, 'http://localhost:3101/');
    assert.deepEqual(zone.waitFor, [
      'http://localhost:3101/mf-manifest.json',
      'http://localhost:3102/mf-manifest.json',
      'http://localhost:3999/mount.js',
    ]);
  });

  it('fails clearly when a registered remote has no dev manifest entry', () => {
    const { shellDir } = fixture();
    fs.writeFileSync(
      path.join(shellDir, 'mfe-manifest.dev.json'),
      JSON.stringify({ remotes: {} }),
    );
    assert.throws(
      () => loadZone(shellDir),
      /intranet_staff \(remotes.json\) has no entry in mfe-manifest.dev.json/,
    );
  });

  it('finds the workspace root', () => {
    const { root, shellDir } = fixture();
    assert.equal(findWorkspaceRoot(shellDir), root);
  });

  it('recognises the mock vendor', () => {
    assert.equal(isMockVendor({ url: 'http://localhost:3999/mount.js' }), true);
    assert.equal(
      isMockVendor({ url: 'https://vendor.example/mount.js' }),
      false,
    );
    assert.equal(isMockVendor(undefined), false);
  });
});

describe('createZoneConfig', () => {
  it('desktop + 375px mobile, zone dev servers, reuse locally', () => {
    const { root, shellDir } = fixture();
    const config = createZoneConfig({ shellDir, env: {} });
    assert.deepEqual(
      config.projects?.map((p) => [p.name, p.use?.viewport?.width]),
      [
        ['desktop', 1280],
        ['mobile', 375],
      ],
    );
    const server = /** @type {any} */ (config.webServer);
    assert.equal(server.command, 'pnpm run dev:intranet');
    assert.equal(server.cwd, root);
    assert.equal(server.url, 'http://localhost:3100');
    assert.equal(server.reuseExistingServer, true);
    assert.equal(config.use?.baseURL, 'http://localhost:3100');
    assert.equal(config.retries, 0);
    assert.deepEqual(
      /** @type {any} */ (config.metadata).mfeWaitFor,
      loadZone(shellDir).waitFor,
    );
    assert.equal(config.testDir, path.join(shellDir, 'e2e'));
  });

  it('CI: fresh servers, retries, junit report, forbidOnly', () => {
    const { shellDir } = fixture();
    const config = createZoneConfig({ shellDir, env: { CI: 'true' } });
    assert.equal(
      /** @type {any} */ (config.webServer).reuseExistingServer,
      false,
    );
    assert.equal(config.retries, 2);
    assert.equal(config.forbidOnly, true);
    assert.ok(JSON.stringify(config.reporter).includes('junit'));
  });

  it('MFE_E2E_SKIP_WEBSERVER and MFE_E2E_WORKERS', () => {
    const { shellDir } = fixture();
    const config = createZoneConfig({
      shellDir,
      env: { MFE_E2E_SKIP_WEBSERVER: '1', MFE_E2E_WORKERS: '4' },
    });
    assert.equal(config.webServer, undefined);
    assert.equal(config.workers, 4);
  });
});

describe('waitForUrls', () => {
  it('resolves once every URL answers', async () => {
    let hits = 0;
    const server = http.createServer((_req, res) => {
      hits += 1;
      res.statusCode = hits < 3 ? 503 : 200;
      res.end('ok');
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', () => r(null)));
    const { port } = /** @type {import('node:net').AddressInfo} */ (
      server.address()
    );
    try {
      await waitForUrls([`http://127.0.0.1:${port}/x`], {
        timeoutMs: 10_000,
        intervalMs: 50,
      });
      assert.ok(hits >= 3);
    } finally {
      server.close();
    }
  });

  it('names the URLs that never answered', async () => {
    await assert.rejects(
      waitForUrls(['http://127.0.0.1:9/nothing'], {
        timeoutMs: 300,
        intervalMs: 50,
        hint: 'Start pnpm dev:intranet',
      }),
      /Not responding after 0 s:\n {2}- http:\/\/127\.0\.0\.1:9\/nothing\nStart pnpm dev:intranet/,
    );
  });
});

describe('formatViolations', () => {
  it('one readable line per failing node', () => {
    const lines = formatViolations(
      /** @type {any} */ ([
        {
          id: 'color-contrast',
          impact: 'serious',
          help: 'Elements must meet minimum color contrast ratio thresholds',
          helpUrl: 'https://dequeuniversity.com/rules/axe/4.11/color-contrast',
          nodes: [
            {
              target: ['.badge'],
              failureSummary: 'Fix any of the following:\n  low contrast',
            },
          ],
        },
      ]),
    );
    assert.equal(lines.length, 1);
    assert.match(
      lines[0],
      /^color-contrast \[serious\] .* → \.badge — Fix any of the following: low contrast \(https:/,
    );
  });
});
