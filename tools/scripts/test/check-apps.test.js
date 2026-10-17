// @ts-check
import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { checkApps } from '../src/check-apps.js';
import {
  app,
  entry,
  makeWorkspace,
  rules,
  validApps,
  validRegistries,
  cleanupWorkspaces,
} from './fixture.js';

/** @param {Record<string, object>} apps @param {Record<string, string | object>} [files] */
const run = (apps, files = validRegistries()) =>
  checkApps({ root: makeWorkspace({ apps, files }) });

after(cleanupWorkspaces);

describe('check-apps', () => {
  it('passes on a valid workspace', async () => {
    const r = await run(validApps());
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.warnings, []);
  });

  it('passes with no apps (template state)', async () => {
    const r = await checkApps({ root: makeWorkspace() });
    assert.deepEqual(r, { errors: [], warnings: [] });
  });

  it('(g) fails on a duplicate port', async () => {
    const r = await run({
      ...validApps(),
      'intranet/leave': app('leave', { port: 3101, access: 'private' }),
    });
    assert.deepEqual(rules(r.errors), ['app-port-duplicate']);
    assert.match(r.errors[0].message, /Dev port 3101 is used by 2 apps/);
    assert.match(r.errors[0].message, /@org\/intranet-leave/);
    assert.match(r.errors[0].message, /@org\/intranet-staff/);
  });

  it('fails on a port outside the zone range or missing', async () => {
    let r = await run({
      ...validApps(),
      'intranet/staff': app('staff', { port: 3290 }),
    });
    assert.deepEqual(rules(r.errors), ['app-port']);
    assert.match(r.errors[0].message, /outside the intranet range 3100-3199/);
    r = await run({ ...validApps(), 'intranet/staff': app('staff', {}) });
    assert.deepEqual(rules(r.errors), ['app-port']);
  });

  it('fails on missing or wrong tags', async () => {
    let r = await run({
      ...validApps(),
      'intranet/staff': app('staff', {
        port: 3101,
        tags: ['zone:intranet', 'type:remote'],
      }),
    });
    assert.deepEqual(rules(r.errors), ['app-tags']);
    assert.match(r.errors[0].message, /access:public/);
    r = await run({
      ...validApps(),
      'intranet/staff': app('staff', {
        port: 3101,
        tags: ['zone:internet', 'type:remote', 'access:public', 'kind:vendor'],
      }),
    });
    assert.deepEqual(rules(r.errors), ['app-tags', 'app-tags']);
    const pkg = app('staff', { port: 3101 });
    delete (/** @type {any} */ (pkg).nx);
    r = await run({ ...validApps(), 'intranet/staff': pkg });
    assert.ok(rules(r.errors).includes('app-tags'));
  });

  it('fails on misplaced apps and bad shells', async () => {
    let r = await run({
      ...validApps(),
      'intranet/group/x': app('x', { port: 3110 }),
    });
    assert.deepEqual(rules(r.errors), ['app-location']);
    r = await run({ ...validApps(), 'extranet/x': app('x', { port: 3110 }) });
    assert.deepEqual(rules(r.errors), ['app-location']);
    r = await run({
      ...validApps(),
      'intranet/main': app('main', {
        type: 'shell',
        port: 3150,
        extra: { name: '@org/intranet-main' },
        federationName: 'intranet_main',
      }),
    });
    // a second shell, misnamed, without remotes.json
    assert.deepEqual(rules(r.errors), ['app-shell', 'app-shell', 'registry']);
  });

  it('fails on duplicate federation names', async () => {
    const r = await run({
      ...validApps(),
      'intranet/leave': app('leave', {
        port: 3102,
        access: 'private',
        federationName: 'intranet_staff',
      }),
    });
    assert.ok(rules(r.errors).includes('app-federation-name-duplicate'));
  });

  it('fails when a remote depends on another remote (package.json)', async () => {
    const r = await run({
      ...validApps(),
      'intranet/leave': app('leave', {
        port: 3102,
        access: 'private',
        deps: { '@org/intranet-staff': 'workspace:*' },
      }),
    });
    assert.deepEqual(rules(r.errors), ['app-dependency']);
    assert.match(r.errors[0].message, /Apps never depend on other apps/);
  });

  it('(e) fails on a cross-zone dependency', async () => {
    const r = await run({
      ...validApps(),
      'intranet/staff': app('staff', {
        port: 3101,
        devDeps: { '@org/internet-services': 'workspace:*' },
      }),
    });
    assert.deepEqual(rules(r.errors), ['app-dependency-cross-zone']);
    assert.match(r.errors[0].message, /Cross-zone dependency/);
  });

  it('(f) fails when a remote imports another remote (source backstop)', async () => {
    const r = await run(validApps(), {
      ...validRegistries(),
      'apps/intranet/leave/src/a.ts':
        "import { Demo } from '@org/intranet-staff/src/features/demo';\nexport { Demo };\n",
    });
    assert.deepEqual(rules(r.errors), ['app-import']);
    assert.match(
      r.errors[0].message,
      /Remotes never import other remotes or shells/,
    );
  });

  it('(e) fails on cross-zone imports, by name, relative path or dynamic import', async () => {
    const r = await run(validApps(), {
      ...validRegistries(),
      'apps/intranet/staff/src/a.ts': [
        "export { x } from '@org/internet-services';",
        "export { y } from '../../../internet/services/src/y';",
        "export const z = () => import('@org/internet-services/src/z');",
        "import '../../leave/src/side-effect';",
        "export { own } from './own';",
        "export { pkg } from '@org/ui';",
      ].join('\n'),
    });
    assert.deepEqual(rules(r.errors), [
      'app-import',
      'app-import-cross-zone',
      'app-import-cross-zone',
      'app-import-cross-zone',
    ]);
  });

  it('fails when a shell imports a remote', async () => {
    const r = await run(validApps(), {
      ...validRegistries(),
      'apps/intranet/shell-intranet/src/a.tsx':
        "import Staff from '@org/intranet-staff';\nexport default Staff;\n",
    });
    assert.deepEqual(rules(r.errors), ['app-import']);
    assert.match(r.errors[0].message, /<RemoteApp>/);
  });

  it('checks shell registries', async () => {
    const files = validRegistries();
    files['apps/intranet/shell-intranet/remotes.json'] = {
      remotes: [
        entry('intranet', 'staff', 'private'),
        entry('intranet', 'gone'),
        entry('internet', 'services'),
      ],
    };
    const r = await run(validApps(), files);
    assert.deepEqual(rules(r.errors), ['registry', 'registry', 'registry']);
    // leave not registered; internet_services missing from the intranet dev manifest
    assert.deepEqual(rules(r.warnings), ['registry', 'registry']);
  });
});
