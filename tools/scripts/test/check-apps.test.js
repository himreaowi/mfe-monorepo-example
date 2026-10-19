// @ts-check
import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import path from 'node:path';
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
    assert.match(r.errors[0].message, /outside the intranet range 3100-3189/);
    r = await run({ ...validApps(), 'intranet/staff': app('staff', {}) });
    assert.deepEqual(rules(r.errors), ['app-port']);
  });

  it('fails on a port in the zone range reserved for dev tools', async () => {
    const r = await run({
      ...validApps(),
      'intranet/staff': app('staff', { port: 3191 }),
    });
    assert.deepEqual(rules(r.errors), ['app-port']);
    assert.match(
      r.errors[0].message,
      /port 3191 is reserved for the intranet dev tools \(3190-3199/,
    );
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

  describe('component layout (one folder per component)', () => {
    const staff = 'apps/intranet/staff/src';
    const ok = (/** @type {string} */ dir, /** @type {string} */ name) => ({
      [`${dir}/${name}/${name}.tsx`]: `import styles from './${name}.module.scss';\nexport const ${name} = () => styles;\n`,
      [`${dir}/${name}/${name}.module.scss`]: '.a { color: red; }\n',
      [`${dir}/${name}/${name}.test.tsx`]: '',
      [`${dir}/${name}/index.ts`]: `export { ${name} } from './${name}';\n`,
    });

    it('passes on folder-per-component features and app components', async () => {
      const r = await run(validApps(), {
        ...validRegistries(),
        ...ok(`${staff}/features/staff/components`, 'StaffCard'),
        ...ok(`${staff}/features/staff/components`, 'StaffSearch'),
        ...ok(`${staff}/components`, 'Badge'),
        // layouts follow the same rule (a remote's StandaloneLayout, the shell's ShellLayout)
        ...ok(`${staff}/layouts`, 'StandaloneLayout'),
        ...ok('apps/intranet/shell-intranet/src/layouts', 'ShellLayout'),
        // a private sub-part may use its component's styles (same folder)
        [`${staff}/features/staff/components/StaffSearch/SearchField.tsx`]:
          "import styles from './StaffSearch.module.scss';\nexport const F = () => styles;\n",
        [`${staff}/features/staff/components/index.ts`]:
          "export * from './StaffCard';\n",
        [`${staff}/features/staff/index.ts`]:
          "export { StaffSearch } from './components/StaffSearch';\n",
        [`${staff}/features/staff/__fixtures__/staff.ts`]:
          'export const a = 1;\n',
        [`${staff}/features/staff/utils/format.ts`]: 'export const b = 1;\n',
        [`${staff}/pages/HomePage/HomePage.tsx`]:
          "import styles from './HomePage.module.scss';\nexport const P = () => styles;\n",
      });
      assert.deepEqual(r.errors, []);
    });

    it('fails on loose component files, misnamed folders and missing index/test', async () => {
      const r = await run(validApps(), {
        ...validRegistries(),
        [`${staff}/features/staff/StaffCard.tsx`]: '',
        [`${staff}/features/staff/components/StaffList.tsx`]: '',
        [`${staff}/features/staff/components/Staff.module.scss`]: '',
        [`${staff}/features/staff/components/testData.ts`]: '',
        [`${staff}/features/staff/components/__fixtures__/a.ts`]: '',
        [`${staff}/features/staff/components/card/Card.tsx`]: '',
        [`${staff}/features/staff/components/Detail/Detail.tsx`]: '',
        [`${staff}/components/Badge.tsx`]: '',
        [`${staff}/layouts/StandaloneLayout.tsx`]: '',
        'apps/intranet/shell-intranet/src/layouts/ShellLayout/ShellLayout.tsx':
          '',
        'apps/intranet/shell-intranet/src/layouts/ShellLayout/index.ts': '',
      });
      assert.deepEqual(rules(r.errors).sort(), [
        ...Array(9).fill('component-folder'),
        'component-test',
        'component-test',
      ]);
      const text = r.errors.map((e) => e.message).join('\n');
      assert.match(text, /move it to components\/StaffCard\/StaffCard\.tsx/);
      assert.match(
        text,
        /apps\/intranet\/staff\/src\/features\/staff\/components\/StaffList\/StaffList\.tsx/,
      );
      assert.match(text, /__fixtures__\/ \(or utils\/\)/);
      assert.match(text, /components\/Detail\/: missing index\.ts/);
      assert.match(text, /components\/Detail\/: missing Detail\.test\.tsx/);
      assert.match(text, /src\/components\/Badge\/Badge\.tsx/);
      assert.match(
        text,
        /src\/layouts\/StandaloneLayout\/StandaloneLayout\.tsx/,
      );
      assert.match(
        text,
        /layouts\/ShellLayout\/: missing ShellLayout\.test\.tsx/,
      );
    });

    it('fails when a CSS module is imported from another folder (shared styles)', async () => {
      const r = await run(validApps(), {
        ...validRegistries(),
        ...ok(`${staff}/features/staff/components`, 'StaffCard'),
        ...ok(`${staff}/features/staff/components`, 'StaffDetail'),
        [`${staff}/features/staff/components/StaffDetail/StaffDetail.tsx`]:
          "import styles from '../StaffCard/StaffCard.module.scss';\nexport const D = () => styles;\n",
        [`${staff}/pages/HomePage/HomePage.tsx`]:
          "import s from '@/features/staff/components/StaffCard/StaffCard.module.scss';\nexport const P = () => s;\n",
      });
      assert.deepEqual(rules(r.errors), ['component-style', 'component-style']);
      const text = r.errors.map((e) => e.message).join('\n');
      assert.match(
        text,
        /StaffDetail\.module\.scss with only the rules it uses/,
      );
      assert.match(text, /HomePage\.tsx imports "@\/features\/staff/);
    });

    it('fails when a remote sets custom properties for the whole page', async () => {
      const r = await run(validApps(), {
        ...validRegistries(),
        ...ok('apps/intranet/shell-intranet/src/layouts', 'ShellLayout'),
        ...ok(`${staff}/features/x/components`, 'X'),
        // the shell may set page tokens (src/styles/shell.scss) and its layout's own values
        'apps/intranet/shell-intranet/src/styles/shell.scss':
          ':root { --color-accent: #1d4ed8; }\n',
        'apps/intranet/shell-intranet/src/layouts/ShellLayout/ShellLayout.module.scss':
          '.host { --header-bg: #1d4ed8; }\n',
        // component-scoped custom properties and reading tokens are fine in a remote
        [`${staff}/components/Card/Card.module.scss`]:
          ".card { --gap: 1rem; color: var(--color-text); }\n:global([data-theme='dark']) .card {\n  --gap: 2rem;\n}\n@media (max-width: 40rem) { .card { --gap: 0; } }\n.w { width: min(#{$x}, 100%); }\n// :root { --color-bg: red; }\n/* html { --color-bg: red; } */\n",
        [`${staff}/components/Card/Card.tsx`]:
          "import styles from './Card.module.scss';\nexport const Card = () => styles;\n",
        [`${staff}/components/Card/Card.test.tsx`]:
          "document.documentElement.style.setProperty('--color-bg', 'red');\n",
        [`${staff}/components/Card/index.ts`]:
          "export { Card } from './Card';\n",
        // page-wide: :root / html / body / [data-theme], also nested or in @media, or from script
        [`${staff}/styles/global.scss`]: ':root { --color-surface: red; }\n',
        [`${staff}/features/x/components/X/X.module.scss`]:
          "@media (min-width: 1px) {\n  :global(html[data-theme='dark']) {\n    --color-accent: red;\n  }\n}\n",
        [`${staff}/bootstrap.tsx`]:
          "document.documentElement.style.setProperty('--color-bg', 'red');\n",
      });
      assert.deepEqual(rules(r.errors).sort(), [
        'remote-global-tokens',
        'remote-global-tokens',
        'remote-global-tokens',
      ]);
      const text = r.errors.map((e) => e.message).join('\n');
      assert.match(
        text,
        /staff\/src\/styles\/global\.scss sets --color-surface on ":root"/,
      );
      assert.match(text, /X\.module\.scss sets --color-accent on/);
      assert.match(
        text,
        /staff\/src\/bootstrap\.tsx sets --color-bg on the document/,
      );
      assert.match(text, /restyle the shell's layout/);
    });
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

  describe('dev tool servers (root package.json mfe.tools)', () => {
    /** @param {unknown} tools */
    const withTools = (tools) =>
      checkApps({
        root: makeWorkspace({
          packages: {
            ui: { name: '@org/ui', version: '0.1.0' },
            'mock-api': { name: '@org/mock-api', version: '1.0.0' },
            'example-vendor': { name: '@org/example-vendor', version: '1.0.0' },
          },
          files: {
            'package.json': {
              name: '@org/root',
              private: true,
              mfe: { tools },
            },
          },
        }),
      });

    it('accepts unique offsets in the tools range naming workspace packages', async () => {
      const r = await withTools({
        mockApi: { offset: 0, package: '@org/mock-api' },
        exampleVendor: {
          offset: 2,
          package: '@org/example-vendor',
          description: 'vendor demo server',
        },
        bare: { offset: 9 },
      });
      assert.deepEqual(r.errors, []);
    });

    it('fails on a duplicate offset (same port in every zone)', async () => {
      const r = await withTools({
        mockApi: { offset: 0, package: '@org/mock-api' },
        exampleVendor: { offset: 0, package: '@org/example-vendor' },
      });
      assert.deepEqual(rules(r.errors), ['tool-port-duplicate']);
      assert.match(
        r.errors[0].message,
        /mockApi, exampleVendor all use offset 0/,
      );
      assert.match(r.errors[0].message, /3190 \/ 3290/);
      assert.match(r.errors[0].message, /free: 1, 2/);
    });

    it('fails on an offset outside the tools range', async () => {
      for (const offset of [10, -1, 1.5, '2', undefined]) {
        const r = await withTools({ exampleVendor: { offset } });
        assert.deepEqual(rules(r.errors), ['tool-port'], String(offset));
        assert.match(r.errors[0].message, /integer 0-9/);
        assert.match(
          r.errors[0].message,
          /intranet 3190-3199, internet 3290-3299/,
        );
      }
    });

    it('fails on a malformed entry, a bad name or an unknown package', async () => {
      let r = await withTools([]);
      assert.deepEqual(rules(r.errors), ['tool-config']);
      r = await withTools({ 'example-vendor': { offset: 2 } });
      assert.deepEqual(rules(r.errors), ['tool-config']);
      r = await withTools({ exampleVendor: 2 });
      assert.deepEqual(rules(r.errors), ['tool-config']);
      r = await withTools({ exampleVendor: { offset: 2, port: 3292 } });
      assert.deepEqual(rules(r.errors), ['tool-config']);
      assert.match(r.errors[0].message, /unknown field\(s\) port/);
      r = await withTools({
        exampleVendor: { offset: 2, package: '@org/nope' },
      });
      assert.deepEqual(rules(r.errors), ['tool-config']);
      assert.match(r.errors[0].message, /not a workspace package/);
    });

    it('the repo declares the mock API and mock vendor', async () => {
      const r = await checkApps({
        root: path.resolve(import.meta.dirname, '../../..'),
      });
      assert.deepEqual(
        r.errors.filter((e) => e.rule.startsWith('tool-')),
        [],
      );
    });
  });
});
