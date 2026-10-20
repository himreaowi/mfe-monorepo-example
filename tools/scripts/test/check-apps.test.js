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
      'intranet/leave': app('leave', { port: 3111, access: 'private' }),
    });
    // the dev manifest still has the old port: regenerated after the fix
    assert.deepEqual(rules(r.errors), ['app-port-duplicate', 'dev-manifest']);
    const duplicate = r.errors.find((e) => e.rule === 'app-port-duplicate');
    assert.match(duplicate?.message ?? '', /Dev port 3111 is used by 2 apps/);
    assert.match(duplicate?.message ?? '', /@org\/intranet-leave/);
    assert.match(duplicate?.message ?? '', /@org\/intranet-staff/);
  });

  it('fails on a port outside the zone range or missing', async () => {
    let r = await run({
      ...validApps(),
      'intranet/staff': app('staff', { port: 3290 }),
    });
    assert.deepEqual(rules(r.errors), ['app-port', 'dev-manifest']);
    assert.match(
      r.errors[0].message,
      /outside the intranet remotes range 3110-3189/,
    );
    r = await run({ ...validApps(), 'intranet/staff': app('staff', {}) });
    assert.deepEqual(rules(r.errors), ['app-port', 'dev-manifest']);
  });

  it('fails on a port in the zone range reserved for dev tools', async () => {
    const r = await run({
      ...validApps(),
      'intranet/staff': app('staff', { port: 3191 }),
    });
    assert.deepEqual(rules(r.errors), ['app-port', 'dev-manifest']);
    assert.match(
      r.errors[0].message,
      /port 3191 is reserved for the intranet dev tools .*tools 3190-3199/,
    );
  });

  it('fails on missing or wrong tags', async () => {
    let r = await run({
      ...validApps(),
      'intranet/staff': app('staff', {
        port: 3111,
        tags: ['zone:intranet', 'type:remote'],
      }),
    });
    assert.deepEqual(rules(r.errors), ['app-tags']);
    assert.match(r.errors[0].message, /access:public/);
    r = await run({
      ...validApps(),
      'intranet/staff': app('staff', {
        port: 3111,
        tags: ['zone:internet', 'type:remote', 'access:public', 'kind:vendor'],
      }),
    });
    assert.deepEqual(rules(r.errors), ['app-tags', 'app-tags']);
    const pkg = app('staff', { port: 3111 });
    delete (/** @type {any} */ (pkg).nx);
    r = await run({ ...validApps(), 'intranet/staff': pkg });
    assert.ok(rules(r.errors).includes('app-tags'));
  });

  it('fails on misplaced apps and bad shells', async () => {
    let r = await run({
      ...validApps(),
      'intranet/group/x': app('x', { port: 3120 }),
    });
    assert.deepEqual(rules(r.errors), ['app-location']);
    r = await run({ ...validApps(), 'extranet/x': app('x', { port: 3120 }) });
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
    // a second shell: misnamed folder, remote port, base path "/" taken, no remotes.json
    assert.deepEqual(rules(r.errors), [
      'app-base-path',
      'app-port',
      'app-shell',
      'registry',
    ]);
    r = await run({
      ...validApps(),
      'intranet/staff': app('staff', { port: 3102 }),
      'intranet/shell-intranet': app('shell', { type: 'shell', port: 3111 }),
    });
    assert.deepEqual(rules(r.errors), ['app-port', 'app-port', 'dev-manifest']);
    r = await run({
      ...validApps(),
      'intranet/shell-intranet': app('shell', { type: 'shell', port: 3100 }),
    });
    assert.match(r.errors[0].message, /port 3100 is the intranet dev proxy/);
  });

  describe('several shells per zone', () => {
    /** @param {string} name @param {number} port */
    const shell = (name, port) =>
      app('shell', {
        zone: 'internet',
        type: 'shell',
        port,
        federationName: `internet_shell_${name}`,
        extra: { name: `@org/shell-${name}` },
      });
    /** @param {Record<string, string | undefined>} bases name → base path */
    const setup = (
      bases,
      rootMfe = { zones: { internet: { defaultShell: 'citizen' } } },
      registries = {},
    ) => {
      /** @type {Record<string, object>} */
      const apps = { ...validApps() };
      delete apps['internet/shell-internet'];
      /** @type {Record<string, string | object>} */
      const files = { ...validRegistries() };
      delete files['apps/internet/shell-internet/remotes.json'];
      delete files['apps/internet/shell-internet/mfe-manifest.dev.json'];
      let port = 3201;
      for (const [name, basePath] of Object.entries(bases)) {
        const pkg = /** @type {any} */ (shell(name, port));
        port += 1;
        if (basePath !== undefined) pkg.mfe.basePath = basePath;
        apps[`internet/shell-${name}`] = pkg;
        const remotes = /** @type {any} */ (registries)[name] ?? ['services'];
        files[`apps/internet/shell-${name}/remotes.json`] = {
          remotes: remotes.map((/** @type {string} */ r) =>
            entry('internet', r),
          ),
        };
        files[`apps/internet/shell-${name}/mfe-manifest.dev.json`] = {
          remotes: Object.fromEntries(
            remotes.map((/** @type {string} */ r) => [
              `internet_${r}`,
              {
                entry: `http://localhost:${r === 'services' ? 3211 : 3212}/mf-manifest.json`,
              },
            ]),
          ),
        };
      }
      return checkApps({ root: makeWorkspace({ apps, files, rootMfe }) });
    };

    it('passes with two shells under their own base paths sharing a remote', async () => {
      const r = await setup({ citizen: '/citizen', business: '/business' });
      assert.deepEqual(r.errors, []);
      assert.deepEqual(r.warnings, []);
    });

    it('fails on equal or nested base paths, and two shells at "/"', async () => {
      let r = await setup({ citizen: '/citizen', business: '/citizen' });
      assert.deepEqual(rules(r.errors), ['app-base-path']);
      r = await setup({ citizen: '/citizen', business: '/citizen/business' });
      assert.deepEqual(rules(r.errors), ['app-base-path']);
      r = await setup({ citizen: undefined, business: '/' }, {});
      assert.deepEqual(rules(r.errors), ['app-base-path']);
      // "/" next to a base path is fine (the longest match wins)
      r = await setup({ citizen: '/citizen', business: undefined }, {});
      assert.deepEqual(r.errors, []);
    });

    it('fails on a malformed base path', async () => {
      const r = await setup({ citizen: '/Citizen/', business: '/business' });
      assert.deepEqual(rules(r.errors), ['app-base-path']);
      assert.match(r.errors[0].message, /"\/citizen"/);
    });

    it('needs a default shell when no shell sits at "/", and only then', async () => {
      let r = await setup({ citizen: '/citizen', business: '/business' }, {});
      assert.deepEqual(rules(r.errors), ['zone-default-shell']);
      assert.match(
        r.errors[0].message,
        /defaultShell": "<business \| citizen>"/,
      );
      r = await setup(
        { citizen: '/citizen', business: '/business' },
        { zones: { internet: { defaultShell: 'nope' } } },
      );
      assert.deepEqual(rules(r.errors), ['zone-default-shell']);
      r = await setup({ citizen: undefined, business: '/business' });
      assert.deepEqual(rules(r.errors), ['zone-default-shell']);
    });

    it('a remote listed by no shell of its zone warns once', async () => {
      const r = await setup(
        { citizen: '/citizen', business: '/business' },
        undefined,
        {
          citizen: [],
          business: [],
        },
      );
      assert.deepEqual(r.errors, []);
      assert.equal(r.warnings.length, 1);
      assert.match(
        r.warnings[0].message,
        /not registered in the remotes.json of any internet shell/,
      );
    });

    it('fails on a base path on a remote', async () => {
      const remote = /** @type {any} */ (
        app('services', { zone: 'internet', port: 3211 })
      );
      remote.mfe.basePath = '/x';
      const r = await run({ ...validApps(), 'internet/services': remote });
      assert.deepEqual(rules(r.errors), ['app-base-path']);
    });
  });

  it('fails on duplicate federation names', async () => {
    const r = await run({
      ...validApps(),
      'intranet/leave': app('leave', {
        port: 3112,
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
        port: 3112,
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
        port: 3111,
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
        // the feature's public API is the only index.ts
        [`${staff}/features/staff/index.ts`]:
          "export { StaffSearch } from './components/StaffSearch/StaffSearch';\n",
        [`${staff}/features/staff/__fixtures__/staff.ts`]:
          'export const a = 1;\n',
        [`${staff}/features/staff/utils/format.ts`]: 'export const b = 1;\n',
        [`${staff}/pages/HomePage/HomePage.tsx`]:
          "import styles from './HomePage.module.scss';\nexport const P = () => styles;\n",
      });
      assert.deepEqual(r.errors, []);
    });

    it('fails on loose component files, misnamed folders and missing tests', async () => {
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
      });
      assert.deepEqual(rules(r.errors).sort(), [
        ...Array(8).fill('component-folder'),
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

    it('state/ folders need a reducer test', async () => {
      const shell = 'apps/intranet/shell-intranet/src';
      const r = await run(validApps(), {
        ...validRegistries(),
        // ok: feature state and app-level state with their reducer tests
        [`${staff}/features/staff/state/staffReducer.ts`]: '',
        [`${staff}/features/staff/state/staffReducer.test.ts`]: '',
        [`${staff}/features/staff/state/StaffContext.tsx`]: '',
        [`${staff}/state/appReducer.ts`]: '',
        [`${staff}/state/appReducer.test.ts`]: '',
        // missing tests
        [`${staff}/features/leave/state/leaveReducer.ts`]: '',
        [`${staff}/features/leave/state/LeaveContext.tsx`]: '',
        [`${shell}/state/ShellContext.tsx`]: '',
      });
      assert.deepEqual(rules(r.errors), ['state-test', 'state-test']);
      const text = r.errors.map((e) => e.message).join('\n');
      assert.match(
        text,
        /features\/leave\/state\/: .*\(leaveReducer\.test\.ts\)/,
      );
      assert.match(
        text,
        /shell-intranet\/src\/state\/: .*<name>Reducer\.ts \+ <name>Reducer\.test\.ts/,
      );
    });

    it('fails on index.ts barrels outside a feature root', async () => {
      const r = await run(validApps(), {
        ...validRegistries(),
        ...ok(`${staff}/features/staff/components`, 'StaffCard'),
        ...ok(`${staff}/components`, 'Badge'),
        ...ok('apps/intranet/shell-intranet/src/layouts', 'ShellLayout'),
        [`${staff}/features/staff/index.ts`]:
          "export { StaffCard } from './components/StaffCard/StaffCard';\n",
        [`${staff}/features/staff/components/StaffCard/index.ts`]: '',
        [`${staff}/features/staff/components/index.ts`]: '',
        [`${staff}/features/staff/api/index.ts`]: '',
        [`${staff}/components/Badge/index.tsx`]: '',
        [`${staff}/pages/HomePage/index.ts`]: '',
        'apps/intranet/shell-intranet/src/layouts/ShellLayout/index.ts': '',
        [`${staff}/providers/index.ts`]: '',
      });
      assert.deepEqual(rules(r.errors), Array(7).fill('barrel-file'));
      assert.match(
        r.errors[0].message,
        /no index\.ts barrels\. Import from the file itself/,
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
        // page-wide: :root / html / body / [data-theme], also nested or in @media, or from script
        [`${staff}/styles/global.scss`]: ':root { --color-surface: red; }\n',
        [`${staff}/features/x/components/X/X.module.scss`]:
          "@media (min-width: 1px) {\n  :global(html[data-theme='dark']) {\n    --color-accent: red;\n  }\n}\n",
        [`${staff}/main.tsx`]:
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
        /staff\/src\/main\.tsx sets --color-bg on the document/,
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
    assert.deepEqual(rules(r.errors), [
      // the registry changed, the committed dev manifest did not
      'dev-manifest',
      'registry',
      'registry',
      'registry',
    ]);
    // leave not registered
    assert.deepEqual(rules(r.warnings), ['registry']);
  });

  describe('generated dev manifest (mfe-manifest.dev.json)', () => {
    const vendor = { url: 'http://localhost:3191/mount.js', format: 'esm' };
    /** @param {Record<string, unknown>} devManifest */
    const shellWith = (devManifest) => {
      const shell = app('shell', { type: 'shell', port: 3101 });
      return { ...shell, mfe: { ...shell.mfe, devManifest } };
    };
    const devManifest = {
      auth: { mock: true },
      settings: { apiBaseUrl: 'http://localhost:3190/api' },
      remotes: { intranet_staff: { props: { vendor } } },
    };

    it('passes when the file is what the generator writes (ports, registry order, mfe.devManifest)', async () => {
      /** @type {Record<string, object>} */
      const files = validRegistries();
      files['apps/intranet/shell-intranet/mfe-manifest.dev.json'] = {
        remotes: {
          intranet_staff: {
            entry: 'http://localhost:3111/mf-manifest.json',
            props: { vendor },
          },
          intranet_leave: { entry: 'http://localhost:3112/mf-manifest.json' },
        },
        auth: { mock: true },
        settings: { apiBaseUrl: 'http://localhost:3190/api' },
      };
      const r = await run(
        { ...validApps(), 'intranet/shell-intranet': shellWith(devManifest) },
        files,
      );
      assert.deepEqual(r.errors, []);
    });

    it('fails when a remote port changed, the file is missing or edited by hand', async () => {
      const moved = await run({
        ...validApps(),
        'intranet/leave': app('leave', { port: 3115, access: 'private' }),
      });
      assert.deepEqual(rules(moved.errors), ['dev-manifest']);
      assert.match(
        moved.errors[0].message,
        /shell-intranet\/mfe-manifest\.dev\.json is out of date\. It is generated from remotes\.json.*run pnpm dev-manifest/,
      );
      const files = validRegistries();
      delete (
        /** @type {Record<string, unknown>} */ (files)[
          'apps/internet/shell-internet/mfe-manifest.dev.json'
        ]
      );
      const missing = await run(validApps(), files);
      assert.deepEqual(rules(missing.errors), ['dev-manifest']);
      assert.match(missing.errors[0].message, /is missing/);
      const edited = await run({
        ...validApps(),
        // dev props must come from mfe.devManifest, not from the file
        'intranet/shell-intranet': shellWith(devManifest),
      });
      assert.deepEqual(rules(edited.errors), ['dev-manifest']);
    });

    it('fails on a malformed mfe.devManifest', async () => {
      const r = await run({
        ...validApps(),
        'intranet/shell-intranet': shellWith(
          /** @type {any} */ ({ remotes: [] }),
        ),
      });
      assert.deepEqual(rules(r.errors), ['dev-manifest']);
      assert.match(r.errors[0].message, /"mfe\.devManifest" must be an object/);
    });
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
