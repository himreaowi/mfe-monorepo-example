// @ts-check
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { after, describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {
  moveComponent,
  planComponentMove,
  targetDir,
} from '../src/move-component.js';
import { checkPackages } from '../src/check-packages.js';
import { app, cleanupWorkspaces, lib, makeWorkspace } from './fixture.js';

after(cleanupWorkspaces);

const STAFF = 'apps/intranet/intranet/staff';
const CARD = `${STAFF}/src/features/people/components/PersonCard`;

/**
 * A git repo: intranet remote `staff` with the component PersonCard (imports @org/ui, its own
 * CSS module and date-fns), an intranet library `people`, a common package `identity`, an
 * internet remote `services`.
 * @param {Record<string, string>} [files]
 */
function repo(files = {}) {
  const root = makeWorkspace({
    apps: {
      'intranet/intranet/shell': app('shell', { type: 'shell', port: 3101 }),
      'intranet/intranet/staff': app('staff', {
        port: 3111,
        deps: { 'date-fns': 'catalog:' },
      }),
      'internet/internet/shell': app('shell', {
        zone: 'internet',
        type: 'shell',
        port: 3201,
      }),
      'internet/internet/services': app('services', {
        zone: 'internet',
        port: 3211,
      }),
      'intranet/libs/people': lib('intranet', 'people'),
    },
    packages: {
      ui: { name: '@org/ui', version: '0.1.0', nx: { tags: ['type:package'] } },
      'common/identity': lib('common', 'identity'),
    },
    files: {
      'apps/intranet/libs/people/src/index.ts':
        "export { formatLabel } from './utils/formatLabel';\n",
      'packages/common/identity/src/index.ts': 'export {};\n',
      [`${CARD}/PersonCard.tsx`]:
        "import { Card } from '@org/ui';\nimport { format } from 'date-fns';\nimport styles from './PersonCard.module.scss';\nexport function PersonCard() { return null; }\n",
      [`${CARD}/PersonCard.module.scss`]: '.card { color: red; }\n',
      [`${CARD}/PersonCard.test.tsx`]:
        "import { PersonCard } from './PersonCard';\n",
      [`${STAFF}/src/pages/StaffPage/StaffPage.tsx`]:
        "import { PersonCard } from '@/features/people/components/PersonCard/PersonCard';\nexport const x = PersonCard;\n",
      [`${STAFF}/src/features/people/components/PersonList/PersonList.tsx`]:
        'import { PersonCard } from "../PersonCard/PersonCard";\njest.mock(\'../PersonCard/PersonCard\');\n',
      [`${STAFF}/src/features/people/components/PersonList/PersonList.test.tsx`]:
        "import { PersonList } from './PersonList';\n",
      ...files,
    },
  });
  const git = (/** @type {string[]} */ ...args) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  git('init', '-q');
  git('add', '-A');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'init');
  return root;
}
const quiet = () => {};
const off = { install: false, check: false, format: false, log: quiet };

describe('move-component', () => {
  it('--to forms', () => {
    assert.equal(targetDir('common/identity'), 'packages/common/identity');
    assert.equal(
      targetDir('packages/common/identity'),
      'packages/common/identity',
    );
    assert.equal(
      targetDir('intranet/libs/people'),
      'apps/intranet/libs/people',
    );
    assert.equal(
      targetDir('apps/intranet/libs/people/'),
      'apps/intranet/libs/people',
    );
    assert.throws(
      () => targetDir('intranet/people'),
      /use common\/<capability>/,
    );
    assert.throws(() => targetDir('moon/libs/x'), /use common/);
  });

  it('--dry-run prints the plan and changes nothing', () => {
    const root = repo();
    /** @type {string[]} */
    const lines = [];
    moveComponent({
      root,
      app: '@org/intranet-staff',
      component: 'PersonCard',
      to: 'intranet/libs/people',
      dryRun: true,
      log: (l) => lines.push(l),
    });
    const text = lines.join('\n');
    assert.match(
      text,
      /git mv apps\/intranet\/intranet\/staff\/src\/features\/people\/components\/PersonCard apps\/intranet\/libs\/people\/src\/components\/PersonCard/,
    );
    assert.match(text, /dependency @org\/intranet-people: workspace:\*/);
    assert.match(text, /dependency @org\/ui: workspace:\*/);
    assert.match(text, /dependency date-fns: catalog:/);
    assert.match(text, /rewrite .* in .*StaffPage\.tsx/);
    assert.ok(fs.existsSync(path.join(root, CARD, 'PersonCard.tsx')));
  });

  it('moves the folder, exports it, wires the dependency and rewrites the imports', () => {
    const root = repo();
    const { plan } = moveComponent({
      root,
      app: STAFF, // by folder
      component: 'PersonCard',
      to: 'intranet/libs/people',
      ...off,
    });
    assert.equal(plan.target.name, '@org/intranet-people');
    const lib = path.join(root, 'apps/intranet/libs/people');
    for (const f of [
      'PersonCard.tsx',
      'PersonCard.module.scss',
      'PersonCard.test.tsx',
    ]) {
      assert.ok(fs.existsSync(path.join(lib, 'src/components/PersonCard', f)));
    }
    assert.ok(!fs.existsSync(path.join(root, CARD)));
    assert.match(
      fs.readFileSync(path.join(lib, 'src/index.ts'), 'utf8'),
      /export \* from '\.\/components\/PersonCard\/PersonCard';\n$/,
    );
    const libPkg = JSON.parse(
      fs.readFileSync(path.join(lib, 'package.json'), 'utf8'),
    );
    assert.deepEqual(libPkg.dependencies, {
      '@org/ui': 'workspace:*',
      'date-fns': 'catalog:',
    });
    const appPkg = JSON.parse(
      fs.readFileSync(path.join(root, STAFF, 'package.json'), 'utf8'),
    );
    assert.equal(appPkg.dependencies['@org/intranet-people'], 'workspace:*');
    assert.match(
      fs.readFileSync(
        path.join(root, STAFF, 'src/pages/StaffPage/StaffPage.tsx'),
        'utf8',
      ),
      /from '@org\/intranet-people'/,
    );
    const list = fs.readFileSync(
      path.join(
        root,
        STAFF,
        'src/features/people/components/PersonList/PersonList.tsx',
      ),
      'utf8',
    );
    assert.match(list, /from "@org\/intranet-people"/);
    assert.match(list, /jest\.mock\('@org\/intranet-people'\)/);
    // git sees a rename (history kept)
    const status = execFileSync('git', ['status', '--porcelain'], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.match(status, /^R {2}.*PersonCard\.tsx -> .*libs\/people/m);
    return checkPackages({ root }).then((r) => assert.deepEqual(r.errors, []));
  });

  it('refuses a missing target (suggests gen:package), a target of the other zone, an unknown app or component', () => {
    const root = repo();
    const base = { root, app: '@org/intranet-staff', component: 'PersonCard' };
    assert.throws(
      () => planComponentMove({ ...base, to: 'intranet/libs/nope' }),
      /apps\/intranet\/libs\/nope does not exist .*pnpm gen:package intranet nope/,
    );
    assert.throws(
      () => planComponentMove({ ...base, to: 'common/nope' }),
      /pnpm gen:package common nope/,
    );
    assert.throws(
      () =>
        planComponentMove({
          ...base,
          app: '@org/internet-services',
          to: 'intranet/libs/people',
        }),
      /No component|has no component/,
    );
    fs.mkdirSync(
      path.join(root, 'apps/internet/internet/services/src/components/Box'),
      { recursive: true },
    );
    fs.writeFileSync(
      path.join(
        root,
        'apps/internet/internet/services/src/components/Box/Box.tsx',
      ),
      'export const Box = 1;\n',
    );
    assert.throws(
      () =>
        planComponentMove({
          root,
          app: '@org/internet-services',
          component: 'Box',
          to: 'intranet/libs/people',
        }),
      /@org\/internet-services may not use @org\/intranet-people .*never the other zone/,
    );
    assert.throws(
      () =>
        planComponentMove({ ...base, app: '@org/nope', to: 'common/identity' }),
      /No app "@org\/nope"/,
    );
    assert.throws(
      () =>
        planComponentMove({
          ...base,
          component: 'Nope',
          to: 'common/identity',
        }),
      /has no component Nope/,
    );
    assert.throws(
      () =>
        planComponentMove({
          ...base,
          component: 'nope',
          to: 'common/identity',
        }),
      /not a component name/,
    );
  });

  it('refuses a move that would break the import rules, and app code outside the folder', () => {
    const root = repo({
      [`${CARD}/PersonCard.tsx`]:
        "import { x } from '@org/intranet-people';\nimport { y } from '@/core/constants/app';\nexport function PersonCard() { return null; }\n",
    });
    // into common: a zone library import is not allowed there, nor app code
    assert.throws(
      () =>
        planComponentMove({
          root,
          app: '@org/intranet-staff',
          component: 'PersonCard',
          to: 'common/identity',
        }),
      (/** @type {Error} */ e) =>
        /would break the import rules/.test(e.message) &&
        /imports "@org\/intranet-people" .*@org\/common-identity may not use/.test(
          e.message,
        ) &&
        /imports "@\/core\/constants\/app", app code outside the component folder/.test(
          e.message,
        ),
    );
    assert.ok(fs.existsSync(path.join(root, CARD, 'PersonCard.tsx')));
  });

  it('refuses when the target already has the component', () => {
    const root = repo({
      'apps/intranet/libs/people/src/components/PersonCard/PersonCard.tsx':
        'export {};\n',
    });
    assert.throws(
      () =>
        planComponentMove({
          root,
          app: '@org/intranet-staff',
          component: 'PersonCard',
          to: 'intranet/libs/people',
        }),
      /already exists; nothing moved/,
    );
  });
});
