// @ts-check
import assert from 'node:assert/strict';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { checkVersions } from '../src/check-versions.js';
import {
  TIER1,
  app,
  cleanupWorkspaces,
  makeWorkspace,
  rules,
  validApps,
} from './fixture.js';

const TODAY = '2026-10-17';
const REPO = path.resolve(import.meta.dirname, '..', '..', '..');

/** @param {Parameters<typeof makeWorkspace>[0]} ws @param {Partial<Parameters<typeof checkVersions>[0]>} [o] */
const run = (ws, o = {}) =>
  checkVersions({
    root: makeWorkspace(ws),
    today: TODAY,
    // the fixture's own tier-1 list (the real one is checked against the repo below)
    tier1: TIER1,
    tier1Singletons: TIER1,
    ...o,
  });

const exception = (/** @type {Record<string, string>} */ over = {}) => ({
  package: 'react',
  version: '18.3.1',
  app: '@org/intranet-staff',
  reason: 'Legacy widget library supports React 18 only (STAFF-123)',
  owner: 'team-staff@example.com',
  expires: '2027-03-31',
  ...over,
});

const pinnedReact = () => ({
  ...validApps(),
  'intranet/intranet/staff': app('staff', {
    port: 3101,
    deps: { react: '18.3.1' },
  }),
});

after(cleanupWorkspaces);

describe('check-versions', () => {
  it('passes on a clean workspace', async () => {
    const r = await run({ apps: validApps(), exceptions: { exceptions: [] } });
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.warnings, []);
  });

  it('passes on the real repository', async () => {
    const r = await checkVersions({ root: REPO, today: TODAY });
    assert.deepEqual(r.errors, []);
  });

  it('(a) fails when an app pins a tier-1 catalog package', async () => {
    const r = await run({ apps: pinnedReact() });
    assert.deepEqual(rules(r.errors), ['tier1-pinned']);
    const msg = r.errors[0].message;
    assert.match(msg, /@org\/intranet-staff/);
    assert.match(msg, /"react": "catalog:"/);
    assert.match(msg, /pnpm --filter @org\/intranet-staff add react@catalog:/);
    assert.match(msg, /version-exceptions\.json/);
    assert.match(msg, /mount-contract/);
  });

  it('fails when a non-tier-1 catalog package is bypassed', async () => {
    const r = await run({
      apps: {
        ...validApps(),
        'intranet/intranet/staff': app('staff', {
          port: 3101,
          devDeps: { typescript: '^6.0.0' },
        }),
      },
    });
    assert.deepEqual(rules(r.errors), ['catalog-bypassed']);
  });

  it('(b) passes with a valid exception', async () => {
    const r = await run({
      apps: pinnedReact(),
      exceptions: { exceptions: [exception()] },
    });
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.warnings, []);
  });

  it('accepts a range spec matching the exception version', async () => {
    const apps = {
      ...validApps(),
      'intranet/intranet/staff': app('staff', {
        port: 3101,
        deps: { react: '^18.3.1' },
      }),
    };
    const r = await run({ apps, exceptions: { exceptions: [exception()] } });
    assert.deepEqual(r.errors, []);
  });

  it('fails when the exception version does not match', async () => {
    const r = await run({
      apps: pinnedReact(),
      exceptions: { exceptions: [exception({ version: '18.2.0' })] },
    });
    assert.deepEqual(rules(r.errors), ['exception-mismatch']);
  });

  it('(c) fails on an expired exception', async () => {
    const r = await run({
      apps: pinnedReact(),
      exceptions: { exceptions: [exception({ expires: '2026-10-16' })] },
    });
    assert.deepEqual(rules(r.errors), ['exception-expired']);
    assert.match(r.errors[0].message, /expired on 2026-10-16/);
    assert.match(r.errors[0].message, /owner: team-staff@example\.com/);
  });

  it('an exception expiring today is still valid', async () => {
    const r = await run({
      apps: pinnedReact(),
      exceptions: { exceptions: [exception({ expires: TODAY })] },
    });
    assert.deepEqual(r.errors, []);
  });

  for (const [label, entry, pattern] of /** @type {const} */ ([
    ['missing owner', { owner: '' }, /"owner" is missing or empty/],
    ['impossible date', { expires: '2027-02-30' }, /real date/],
    ['bad date format', { expires: '31/03/2027' }, /real date/],
    ['short reason', { reason: 'legacy' }, /at least 10 characters/],
    ['unknown app', { app: '@org/nope' }, /no package named "@org\/nope"/],
  ])) {
    it(`fails on a malformed exception (${label})`, async () => {
      const r = await run({
        apps: pinnedReact(),
        exceptions: { exceptions: [exception(entry)] },
      });
      assert.ok(rules(r.errors).includes('exceptions-malformed'), label);
      assert.match(
        r.errors.find((e) => e.rule === 'exceptions-malformed')?.message ?? '',
        pattern,
      );
      // a malformed exception does not excuse the pin
      assert.ok(rules(r.errors).includes('tier1-pinned'));
    });
  }

  it('fails on unknown fields, non-array and invalid JSON', async () => {
    let r = await run({
      apps: validApps(),
      exceptions: { exceptions: [{ ...exception(), ticket: 'X' }] },
    });
    assert.match(r.errors[0].message, /unknown field "ticket"/);
    r = await run({ apps: validApps(), exceptions: { exceptions: {} } });
    assert.deepEqual(rules(r.errors), ['exceptions-malformed']);
    r = await run({ apps: validApps(), exceptions: '{ nope' });
    assert.deepEqual(rules(r.errors), ['exceptions-malformed']);
  });

  it('fails on duplicate exceptions', async () => {
    const r = await run({
      apps: pinnedReact(),
      exceptions: { exceptions: [exception(), exception()] },
    });
    assert.deepEqual(rules(r.errors), ['exceptions-malformed']);
    assert.match(r.errors[0].message, /duplicate/);
  });

  it('warns about unused exceptions', async () => {
    const r = await run({
      apps: validApps(),
      exceptions: { exceptions: [exception()] },
    });
    assert.deepEqual(r.errors, []);
    assert.deepEqual(rules(r.warnings), ['exception-unused']);
  });

  it('allows an app-local (tier 3) dependency in one app', async () => {
    const r = await run({
      apps: {
        ...validApps(),
        'intranet/intranet/staff': app('staff', {
          port: 3101,
          deps: { zod: '^4.6.7' },
        }),
      },
    });
    assert.deepEqual(r.errors, []);
  });

  it('(d) fails when 2+ packages use the same non-catalog dependency', async () => {
    const r = await run({
      apps: {
        ...validApps(),
        'intranet/intranet/staff': app('staff', {
          port: 3101,
          deps: { zod: '^4.6.7' },
        }),
        'internet/internet/services': app('services', {
          zone: 'internet',
          port: 3201,
          deps: { zod: '^4.5.0' },
        }),
      },
    });
    assert.deepEqual(rules(r.errors), ['shared-not-in-catalog']);
    const msg = r.errors[0].message;
    assert.match(msg, /zod is used by 2 workspace packages/);
    assert.match(
      msg,
      /add "zod: 4\.6\.7" under "catalog:" in pnpm-workspace\.yaml/,
    );
    assert.match(msg, /pnpm --filter @org\/intranet-staff add zod@catalog:/);
  });

  it('fails when the tier-1 list drifts from the MF singletons', async () => {
    const r = await run(
      { apps: validApps() },
      { tier1Singletons: ['react', 'react-dom', '@org/ui'] },
    );
    assert.deepEqual(rules(r.errors), ['tier1-drift']);
    assert.match(r.errors[0].message, /Not shared as singleton: react-router/);
  });

  it('fails when a tier-1 package is not in the catalog', async () => {
    const { 'react-router': _rr, ...catalog } = {
      react: '19.3.1',
      'react-dom': '19.3.1',
      'react-router': '8.4.0',
      typescript: '6.0.3',
    };
    const r = await run({ catalog, apps: {} });
    assert.deepEqual(rules(r.errors), ['tier1-missing']);
  });

  it('checks workspace: and catalog: references', async () => {
    const r = await run({
      apps: {
        ...validApps(),
        'intranet/intranet/staff': app('staff', {
          port: 3101,
          deps: {
            '@org/ui': '^0.1.0',
            'left-pad': 'catalog:',
            '@org/x': 'workspace:*',
          },
        }),
      },
    });
    assert.deepEqual(rules(r.errors), [
      'catalog-missing',
      'workspace-protocol',
      'workspace-unknown',
    ]);
  });

  it('ignores peerDependencies ranges', async () => {
    const r = await run({
      apps: validApps(),
      packages: {
        ui: {
          name: '@org/ui',
          version: '0.1.0',
          peerDependencies: { react: '^19.0.0', 'react-router': '^8.0.0' },
        },
      },
    });
    assert.deepEqual(r.errors, []);
  });
});
