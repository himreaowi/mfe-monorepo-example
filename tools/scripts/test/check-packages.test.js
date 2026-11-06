// @ts-check
import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { depConstraints } from '@org/eslint-config';
import { checkApps } from '../src/check-apps.js';
import {
  checkPackages,
  isAllowed,
  layerTags,
  sideOf,
} from '../src/check-packages.js';
import { loadApps } from '../src/workspace.js';
import { affectedFromFiles, listApps } from '../src/apps.js';
import {
  app,
  cleanupWorkspaces,
  lib,
  makeWorkspace,
  rules,
  validApps,
  validRegistries,
} from './fixture.js';

after(cleanupWorkspaces);

/** @typedef {import('../src/check-packages.js').Side} Side */

/** Every kind of package, one per side of the import table. */
const SIDES = /** @type {Record<string, Side & { tags: string[] }>} */ ({
  'intranet remote': {
    layer: 'app',
    zone: 'intranet',
    tags: ['zone:intranet', 'type:remote', 'access:public'],
  },
  'intranet shell': {
    layer: 'app',
    zone: 'intranet',
    tags: ['zone:intranet', 'type:shell', 'access:public'],
  },
  'internet remote': {
    layer: 'app',
    zone: 'internet',
    tags: ['zone:internet', 'type:remote', 'access:public'],
  },
  'intranet lib': {
    layer: 'lib',
    zone: 'intranet',
    tags: ['zone:intranet', 'type:lib'],
  },
  'internet lib': {
    layer: 'lib',
    zone: 'internet',
    tags: ['zone:internet', 'type:lib'],
  },
  common: { layer: 'common', tags: ['type:common'] },
  platform: { layer: 'platform', tags: ['type:package'] },
});

/** Expected table: source → targets it may use (apps never use apps: check-apps). */
const ALLOWED = {
  'intranet remote': ['intranet lib', 'common', 'platform'],
  'intranet shell': ['intranet lib', 'common', 'platform'],
  'internet remote': ['internet lib', 'common', 'platform'],
  'intranet lib': ['intranet lib', 'common', 'platform'],
  'internet lib': ['internet lib', 'common', 'platform'],
  common: ['common', 'platform'],
  platform: ['platform'],
};

/**
 * The Nx semantics of `depConstraints` for one source/target tag pair.
 * @param {string[]} source
 * @param {string[]} target
 */
function nxAllows(source, target) {
  return depConstraints.every((c) => {
    if (!source.includes(c.sourceTag)) return true;
    if (c.onlyDependOnLibsWithTags) {
      return c.onlyDependOnLibsWithTags.some((t) => target.includes(t));
    }
    if (c.notDependOnLibsWithTags) {
      return !c.notDependOnLibsWithTags.some((t) => target.includes(t));
    }
    return true;
  });
}

describe('import table (package-boundaries)', () => {
  for (const [sourceName, source] of Object.entries(SIDES)) {
    for (const [targetName, target] of Object.entries(SIDES)) {
      const expected = /** @type {string[]} */ (
        ALLOWED[/** @type {keyof typeof ALLOWED} */ (sourceName)]
      ).includes(targetName);
      it(`${sourceName} → ${targetName}: ${expected ? 'allowed' : 'denied'} (check and lint agree)`, () => {
        assert.equal(isAllowed(source, target), expected);
        assert.equal(nxAllows(source.tags, target.tags), expected);
      });
    }
  }

  it('sides and tags come from the folder', () => {
    assert.deepEqual(sideOf({ dir: 'apps/intranet/libs/identity' }), {
      layer: 'lib',
      zone: 'intranet',
    });
    assert.deepEqual(sideOf({ dir: 'apps/internet/citizen/services' }), {
      layer: 'app',
      zone: 'internet',
    });
    assert.deepEqual(sideOf({ dir: 'packages/common/identity' }), {
      layer: 'common',
    });
    assert.deepEqual(sideOf({ dir: 'packages/platform/ui' }), {
      layer: 'platform',
    });
    assert.equal(sideOf({ dir: '.' }), undefined);
    for (const side of Object.values(SIDES)) {
      if (side.layer !== 'app') assert.deepEqual(layerTags(side), side.tags);
    }
  });
});

/** A workspace with every side: intranet + internet apps, a lib per zone, a common package. */
function workspace(
  /** @type {{ apps?: Record<string, object>, packages?: Record<string, object>, files?: Record<string, string | object | null> }} */ o = {},
) {
  return makeWorkspace({
    apps: {
      ...validApps(),
      'intranet/libs/people': lib('intranet', 'people'),
      'internet/libs/forms': lib('internet', 'forms'),
      ...(o.apps ?? {}),
    },
    packages: {
      ui: { name: '@org/ui', version: '0.1.0', nx: { tags: ['type:package'] } },
      'common/identity': lib('common', 'identity'),
      ...(o.packages ?? {}),
    },
    // a null value leaves the file out
    files: Object.fromEntries(
      Object.entries({
        ...validRegistries(),
        'apps/intranet/libs/people/src/index.ts': 'export {};\n',
        'apps/internet/libs/forms/src/index.ts': 'export {};\n',
        'packages/common/identity/src/index.ts': 'export {};\n',
        ...(o.files ?? {}),
      }).filter(([, v]) => v !== null),
    ),
  });
}

describe('check-packages', () => {
  it('passes with libs and common packages, and every app check still passes', async () => {
    const root = workspace({
      apps: {
        'intranet/intranet/staff': app('staff', {
          port: 3111,
          deps: {
            '@org/intranet-people': 'workspace:*',
            '@org/common-identity': 'workspace:*',
          },
        }),
      },
      files: {
        'apps/intranet/intranet/staff/src/a.ts':
          "import { x } from '@org/intranet-people';\nimport { y } from '@org/common-identity';\n",
        'apps/intranet/libs/people/src/b.ts':
          "import { y } from '@org/common-identity';\nimport { z } from '@org/ui';\n",
      },
    });
    assert.deepEqual((await checkPackages({ root })).errors, []);
    assert.deepEqual((await checkApps({ root })).errors, []);
  });

  it('passes with no libs folder and with an empty one', async () => {
    let root = makeWorkspace({ apps: validApps(), files: validRegistries() });
    assert.deepEqual((await checkPackages({ root })).errors, []);
    root = makeWorkspace({
      apps: validApps(),
      files: {
        ...validRegistries(),
        'apps/intranet/libs/README.md': '# libs\n',
      },
    });
    assert.deepEqual((await checkPackages({ root })).errors, []);
    assert.deepEqual((await checkApps({ root })).errors, []);
  });

  it('libs are not apps: not listed, no port, but affected through their dependents', () => {
    const root = workspace({
      apps: {
        'intranet/intranet/staff': app('staff', {
          port: 3111,
          deps: { '@org/intranet-people': 'workspace:*' },
        }),
      },
    });
    assert.ok(!loadApps(root).some((a) => a.dir.includes('/libs/')));
    assert.ok(!listApps({ root }).some((a) => a.path.includes('/libs/')));
    const affected = affectedFromFiles({
      root,
      files: ['apps/intranet/libs/people/src/index.ts'],
    });
    assert.ok(affected?.has('@org/intranet-people'));
    assert.ok(affected?.has('@org/intranet-staff'));
    assert.ok(!affected?.has('@org/intranet-leave'));
  });

  it('package.json: an internet remote depending on an intranet library fails', async () => {
    const root = workspace({
      apps: {
        'internet/internet/services': app('services', {
          zone: 'internet',
          port: 3211,
          deps: { '@org/intranet-people': 'workspace:*' },
        }),
      },
    });
    const r = await checkPackages({ root });
    assert.deepEqual(rules(r.errors), ['package-boundaries']);
    assert.match(
      r.errors[0].message,
      /@org\/internet-services \(apps\/internet\/internet\/services\/package\.json dependencies\) depends on the intranet zone library @org\/intranet-people .*An internet remote or shell may use apps\/internet\/libs\/\*, packages\/common\/\* and packages\/platform\/\*.*packages\/common\/<capability>/,
    );
  });

  it('package.json: common → zone library, lib → app, platform → common fail', async () => {
    const root = workspace({
      apps: {
        'intranet/libs/people': lib('intranet', 'people', {
          deps: { '@org/intranet-staff': 'workspace:*' },
        }),
      },
      packages: {
        ui: {
          name: '@org/ui',
          version: '0.1.0',
          nx: { tags: ['type:package'] },
          dependencies: { '@org/common-identity': 'workspace:*' },
        },
        'common/identity': lib('common', 'identity', {
          deps: { '@org/intranet-people': 'workspace:*' },
        }),
      },
    });
    const r = await checkPackages({ root });
    assert.deepEqual(rules(r.errors), [
      'package-boundaries',
      'package-boundaries',
      'package-boundaries',
    ]);
    const text = r.errors.map((e) => e.message).join('\n');
    assert.match(
      text,
      /@org\/common-identity .*depends on the intranet zone library .*packages\/common\/\* may use only packages\/common\/\* and packages\/platform\/\*.*Confidential or intranet-only rules never go to packages\/common/,
    );
    assert.match(
      text,
      /@org\/intranet-people .*depends on the intranet remote @org\/intranet-staff .*never a remote or shell.*pnpm move-component/,
    );
    assert.match(
      text,
      /@org\/ui .*depends on the common package @org\/common-identity .*plumbing/,
    );
  });

  it('imports: by name and by relative path, every denied pair', async () => {
    const root = workspace({
      files: {
        // internet remote → intranet lib (by name)
        'apps/internet/internet/services/src/a.ts':
          "import { x } from '@org/intranet-people';\n",
        // common → zone lib (relative) and → app (by name)
        'packages/common/identity/src/b.ts':
          "import { x } from '../../../../apps/intranet/libs/people/src/index';\nexport const y = () => import('@org/intranet-staff');\n",
        // lib → app (relative) and → other zone lib
        'apps/intranet/libs/people/src/c.ts':
          "import { x } from '../../../intranet/staff/src/x';\nimport { f } from '@org/internet-forms/src/index';\n",
        // allowed: lib → common, lib → platform, own files
        'apps/internet/libs/forms/src/d.ts':
          "import { y } from '@org/common-identity';\nimport { u } from '@org/ui';\nimport { z } from './index';\n",
      },
    });
    const r = await checkPackages({ root });
    const found = r.errors.map((e) => e.message.split(' imports ')[0]).sort();
    assert.deepEqual(found, [
      'apps/internet/internet/services/src/a.ts',
      'apps/intranet/libs/people/src/c.ts',
      'apps/intranet/libs/people/src/c.ts',
      'packages/common/identity/src/b.ts',
      'packages/common/identity/src/b.ts',
    ]);
    assert.ok(r.errors.every((e) => e.rule === 'package-boundaries'));
  });

  it('library-name, library-tags, library-shape', async () => {
    const root = workspace({
      apps: {
        'intranet/libs/people': lib('intranet', 'people', {
          extra: {
            name: '@org/people',
            nx: { tags: ['type:package'] },
            mfe: { port: 3150 },
          },
        }),
      },
      files: {
        'apps/intranet/libs/people/webpack.config.js': 'export default {};\n',
        'packages/common/identity/src/index.ts': null,
      },
    });
    const r = await checkPackages({ root });
    assert.deepEqual(rules(r.errors), [
      'library-name',
      'library-shape',
      'library-shape',
      'library-shape',
      'library-tags',
    ]);
    const text = r.errors.map((e) => e.message).join('\n');
    assert.match(
      text,
      /"name": "@org\/intranet-people" \(found "@org\/people"\)/,
    );
    assert.match(text, /"tags": \["zone:intranet","type:lib"\]/);
    assert.match(text, /remove the "mfe" block/);
    assert.match(text, /remove the webpack config/);
    assert.match(text, /packages\/common\/identity: missing src\/index\.ts/);
  });

  it('library-component-files: <Name>.tsx and <Name>.test.tsx, scss and stories optional', async () => {
    const dir = 'apps/intranet/libs/people/src/components';
    const root = workspace({
      files: {
        [`${dir}/StaffPicker/StaffPicker.tsx`]: 'export {};\n',
        [`${dir}/StaffPicker/StaffPicker.test.tsx`]: 'export {};\n',
        [`${dir}/StaffPicker/StaffPicker.module.scss`]: '',
        [`${dir}/Badge/Badge.tsx`]: 'export {};\n',
        [`${dir}/badge-list/badge-list.tsx`]: 'export {};\n',
        [`${dir}/loose.tsx`]: 'export {};\n',
      },
    });
    const r = await checkPackages({ root });
    assert.deepEqual(rules(r.errors), [
      'library-component-files',
      'library-component-files',
      'library-component-files',
    ]);
    const text = r.errors.map((e) => e.message).join('\n');
    assert.match(text, /Badge\/: .*\(missing: Badge\.test\.tsx\)/);
    assert.match(text, /badge-list\/: .*PascalCase/);
    assert.match(text, /loose\.tsx: one folder per component/);
  });

  it('package-location and package-name', async () => {
    const root = workspace({
      apps: {
        // a lib with the name of a remote of the same zone
        'intranet/libs/staff': lib('intranet', 'staff'),
      },
      files: {
        'apps/intranet/libs/staff/src/index.ts': 'export {};\n',
        'packages/shared/thing/package.json': { name: '@org/thing' },
        'packages/common/deep/er/package.json': { name: '@org/deeper' },
        'apps/intranet/libs/notes.txt': 'x',
        'apps/intranet/libs/empty/.gitkeep': '',
      },
    });
    const r = await checkPackages({ root });
    assert.deepEqual(rules(r.errors), [
      'package-location',
      'package-location',
      'package-location',
      'package-location',
      'package-name',
    ]);
    const text = r.errors.map((e) => e.message).join('\n');
    assert.match(
      text,
      /packages\/shared\/thing\/package\.json: misplaced package/,
    );
    assert.match(text, /packages\/common\/deep\/er\/package\.json: misplaced/);
    assert.match(text, /apps\/intranet\/libs\/notes\.txt: unknown item/);
    assert.match(
      text,
      /apps\/intranet\/libs\/empty\/: a library folder needs a package\.json.*pnpm gen:package intranet empty/,
    );
    assert.match(text, /@org\/intranet-staff is the name of 2 packages/);
  });
});
