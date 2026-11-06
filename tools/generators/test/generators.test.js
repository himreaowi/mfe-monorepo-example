// @ts-check
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import {
  checkApps,
  checkEnv,
  checkPackages,
  checkVersions,
} from '@org/scripts';
import {
  COMMON_WARNING,
  generatePackage,
  generateRemote,
  generateShell,
  mockVendorConfig,
  titleFromName,
} from '../src/index.js';

const REPO = path.resolve(import.meta.dirname, '..', '..', '..');
const BIN = path.join(REPO, 'tools', 'generators', 'bin', 'gen.js');

/** @type {string[]} */
const created = [];
after(() => {
  for (const dir of created) fs.rmSync(dir, { recursive: true, force: true });
});

/**
 * Temp workspace that looks like the template for the checks: the real pnpm-workspace.yaml and
 * version-exceptions.json, the root package.json, every package/tool package.json and the
 * tier-1 list. Empty apps/.
 */
function tempWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mfe-gen-'));
  created.push(root);
  const copy = (/** @type {string} */ rel) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.copyFileSync(path.join(REPO, rel), path.join(root, rel));
  };
  for (const rel of [
    'pnpm-workspace.yaml',
    'version-exceptions.json',
    'package.json',
    'packages/platform/webpack-config/src/tier1.js',
  ]) {
    copy(rel);
  }
  for (const group of ['packages/platform', 'tools']) {
    for (const d of fs.readdirSync(path.join(REPO, group))) {
      if (fs.existsSync(path.join(REPO, group, d, 'package.json'))) {
        copy(`${group}/${d}/package.json`);
      }
    }
  }
  // template state: no zone settings yet (a project's generated shells may have added some)
  const rootPkg = JSON.parse(read(root, 'package.json'));
  if (rootPkg.mfe) delete rootPkg.mfe.zones;
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(rootPkg));
  fs.mkdirSync(path.join(root, 'apps'));
  return root;
}

const read = (/** @type {string} */ root, /** @type {string} */ rel) =>
  fs.readFileSync(path.join(root, rel), 'utf8');
const readJson = (/** @type {string} */ root, /** @type {string} */ rel) =>
  JSON.parse(read(root, rel));

/** All files below dir (relative), without node_modules. */
function listFiles(/** @type {string} */ dir) {
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => path.relative(dir, path.join(d.parentPath, d.name)))
    .sort();
}

describe('generators', () => {
  /** @type {string} */
  let root;

  before(async () => {
    root = tempWorkspace();
  });

  it('refuses gen:remote before the shell exists', async () => {
    await assert.rejects(
      generateRemote({ root, zone: 'intranet', name: 'staff-directory' }),
      /Run "pnpm gen:shell intranet" first/,
    );
  });

  it('generates the intranet shell', async () => {
    const r = await generateShell({ root, zone: 'intranet' });
    assert.equal(r.port, 3101);
    assert.equal(r.layout, 'top');
    assert.equal(r.federationName, 'intranet_shell');
    const dir = 'apps/intranet/intranet/shell';
    const pkg = readJson(root, `${dir}/package.json`);
    assert.equal(pkg.name, '@org/shell-intranet');
    assert.deepEqual(pkg.nx.tags, [
      'zone:intranet',
      'type:shell',
      'access:public',
    ]);
    // mfe.devManifest: the extra content of the generated mfe-manifest.dev.json
    assert.deepEqual(pkg.mfe, {
      port: 3101,
      federationName: 'intranet_shell',
      basePath: '/',
      devManifest: {
        auth: { mock: true },
        // same-origin: the zone's dev proxy forwards /api to API_UPSTREAM (default: mock API)
        settings: { apiBaseUrl: '/api' },
      },
    });
    assert.equal(
      pkg.scripts.dev,
      'mfe-dev-manifest --shell-dir . && webpack serve',
    );
    assert.deepEqual(Object.keys(pkg.scripts), [
      'dev',
      'build',
      'preview',
      'lint',
      'typecheck',
      'test',
      'e2e',
    ]);
    assert.equal(pkg.scripts.e2e, 'playwright test');
    assert.match(pkg.scripts.typecheck, /e2e\/tsconfig\.json/);
    assert.equal(pkg.devDependencies['@playwright/test'], 'catalog:');
    assert.equal(pkg.devDependencies['@axe-core/playwright'], 'catalog:');
    assert.equal(pkg.devDependencies['@org/playwright-config'], 'workspace:*');
    assert.equal(pkg.dependencies['@org/pwa'], 'workspace:*');
    for (const [dep, spec] of Object.entries({
      ...pkg.dependencies,
      ...pkg.devDependencies,
    })) {
      assert.equal(
        spec,
        dep.startsWith('@org/') ? 'workspace:*' : 'catalog:',
        dep,
      );
    }
    assert.deepEqual(readJson(root, `${dir}/remotes.json`).remotes, []);
    assert.deepEqual(readJson(root, `${dir}/mfe-manifest.dev.json`), {
      remotes: {},
      auth: { mock: true },
      settings: { apiBaseUrl: '/api' },
    });
    // `pnpm dev:intranet` / `nx dev` start the zone's mock API with the shell
    assert.deepEqual(pkg.nx.targets, {
      dev: {
        dependsOn: [{ projects: ['@org/mock-api'], target: 'serve:intranet' }],
      },
    });
    assert.match(
      read(root, `${dir}/src/core/constants/app.ts`),
      /APP_TITLE = 'Intranet shell'/,
    );
    assert.equal(pkg.dependencies['@org/auth'], 'workspace:*');
    const files = listFiles(path.join(root, dir));
    for (const f of [
      'README.md',
      'eslint.config.js',
      'jest.config.js',
      'webpack.config.js',
      'tsconfig.json',
      'playwright.config.ts',
      'e2e/tsconfig.json',
      'e2e/helpers.ts',
      'e2e/shell.spec.ts',
      'e2e/remotes.spec.ts',
      'e2e/standalone.spec.ts',
      'e2e/a11y.spec.ts',
      'public/index.html',
      'src/main.tsx',
      'src/styles/shell.scss',
      'src/app/App.tsx',
      'src/app/routes.tsx',
      'src/components/RemoteNav/RemoteNav.tsx',
      'src/features/welcome/components/Welcome/Welcome.tsx',
      'src/features/welcome/components/Welcome/Welcome.test.tsx',
      'src/features/startup/components/StartupError/StartupError.tsx',
      'src/layouts/ShellLayout/ShellLayout.tsx',
      'src/pages/HomePage/HomePage.tsx',
      'src/pages/RemotePage/RemotePage.tsx',
      'src/core/constants/routePaths.ts',
    ]) {
      assert.ok(files.includes(f), `missing ${f}`);
    }
    // the layout is the shell's own code, copied from the "top" starter: one folder per
    // component, no layout option anywhere, built from @org/ui building blocks
    for (const f of [
      'ShellLayout.tsx',
      'ShellLayout.module.scss',
      'ShellLayout.test.tsx',
    ]) {
      assert.ok(files.includes(`src/layouts/ShellLayout/${f}`), `missing ${f}`);
    }
    const layout = read(root, `${dir}/src/layouts/ShellLayout/ShellLayout.tsx`);
    assert.match(layout, /data-nav-placement="top"/);
    assert.match(layout, /<RemoteNav remotes=\{remotes\} \/>/);
    assert.doesNotMatch(
      layout,
      /MainLayout|navPlacement|NAV_PLACEMENT|NavPlacement/,
    );
    for (const block of [
      'Brand',
      'SkipLink',
      'ThemeToggle',
      'useFitLayout',
      'useMenuDisclosure',
    ]) {
      assert.match(layout, new RegExp(`\\b${block}\\b`), block);
    }
    assert.match(layout, /from '@org\/ui'/);
    assert.match(layout, /import styles from '\.\/ShellLayout\.module\.scss'/);
    // the e2e hooks the generated specs rely on
    for (const hook of [
      'main-header',
      'header-brand',
      'header-menu-button',
      'header-panel',
    ]) {
      assert.match(layout, new RegExp(`data-testid="${hook}"`), hook);
    }
    // header colours: one commented block of values in the shell's own layout styles
    const layoutStyles = read(
      root,
      `${dir}/src/layouts/ShellLayout/ShellLayout.module.scss`,
    );
    assert.match(layoutStyles, /HEADER COLOURS: change them here/);
    assert.match(layoutStyles, /^ {2}--header-bg: var\(--color-surface\);$/m);
    assert.match(layoutStyles, /^ {2}--color-surface: var\(--header-bg\);$/m);
    assert.match(layoutStyles, /^ \* +--header-bg: #1d4ed8;$/m); // the blue example, commented
    assert.doesNotMatch(layoutStyles, /\$sidebar-width|\.side\b/);
    // RemoteNav: horizontal by default, vertical on request (no context from @org/ui)
    const remoteNav = read(
      root,
      `${dir}/src/components/RemoteNav/RemoteNav.tsx`,
    );
    assert.match(remoteNav, /orientation = 'horizontal'/);
    assert.doesNotMatch(remoteNav, /useNavPlacement|@org\/ui/);
    // the header e2e tests read the structure from the page (no generated copy per layout)
    assert.match(read(root, `${dir}/e2e/helpers.ts`), /data-nav-placement/);
    assert.match(read(root, `${dir}/e2e/shell.spec.ts`), /expectSidebar/);
    assert.match(read(root, `${dir}/webpack.config.js`), /createShellConfig/);
    // the API client comes from @org/mf-runtime (useApiClient), no per-app services/http.ts
    assert.ok(!files.some((f) => f.startsWith('src/services/')));
    // async startup (@org/webpack-config): one entry file, no import('./bootstrap') boundary
    assert.ok(!files.includes('src/bootstrap.tsx'));
    assert.doesNotMatch(read(root, `${dir}/src/main.tsx`), /import\(/);
    assert.match(
      read(root, `${dir}/src/main.tsx`),
      /registerPwa\(\{ basePath: BASE_PATH \}\)/,
    );
    // shell-wide global styles: imported right after the design tokens; no header colours
    assert.match(
      read(root, `${dir}/src/main.tsx`),
      /^import '@org\/design-tokens\/global\.scss';\n(?:\/\/.*\n)*import '\.\/styles\/shell\.scss';$/m,
    );
    const shellStyles = read(root, `${dir}/src/styles/shell.scss`);
    assert.doesNotMatch(shellStyles, /^(?!\/\/).+$/m, 'comments only');
    assert.doesNotMatch(shellStyles, /--header-/);
    assert.match(shellStyles, /ShellLayout\.module\.scss/);
    for (const text of [
      read(root, `${dir}/README.md`),
      ...files.map((f) => read(root, `${dir}/${f}`)),
    ]) {
      assert.doesNotMatch(text, /MainLayout|useNavPlacement/);
    }
    assert.match(read(root, `${dir}/src/main.tsx`), /loadMfeManifest/);
    assert.match(
      read(root, `${dir}/src/main.tsx`),
      /loadAuthClient\(manifest\.auth\)/,
    );
    assert.match(read(root, `${dir}/src/app/App.tsx`), /<AuthProvider/);
    const page = read(root, `${dir}/src/pages/RemotePage/RemotePage.tsx`);
    assert.match(page, /<RequireAuth/);
    assert.match(page, /remote\.access === 'private'/);
    assert.doesNotMatch(page, /TODO/);
  });

  it('refuses to generate the same shell twice', async () => {
    await assert.rejects(
      generateShell({ root, zone: 'intranet' }),
      /already exists\. Generators never overwrite/,
    );
  });

  it('generates remotes with ports, tags and shell registration', async () => {
    const a = await generateRemote({
      root,
      zone: 'intranet',
      name: 'staff-directory',
    });
    const b = await generateRemote({
      root,
      zone: 'intranet',
      name: 'leave-requests',
      private: true,
    });
    assert.equal(a.port, 3110);
    assert.equal(b.port, 3111);
    assert.equal(a.federationName, 'intranet_staff_directory');
    const pkgA = readJson(
      root,
      'apps/intranet/intranet/staff-directory/package.json',
    );
    const pkgB = readJson(
      root,
      'apps/intranet/intranet/leave-requests/package.json',
    );
    assert.equal(pkgA.name, '@org/intranet-staff-directory');
    assert.deepEqual(pkgA.nx.tags, [
      'zone:intranet',
      'type:remote',
      'access:public',
    ]);
    assert.deepEqual(pkgB.nx.tags, [
      'zone:intranet',
      'type:remote',
      'access:private',
    ]);
    assert.equal(pkgA.dependencies['@org/pwa'], undefined);

    const shell = 'apps/intranet/intranet/shell';
    assert.deepEqual(readJson(root, `${shell}/remotes.json`).remotes, [
      {
        name: 'staff-directory',
        title: 'Staff directory',
        path: '/staff-directory',
        federationName: 'intranet_staff_directory',
        package: '@org/intranet-staff-directory',
        access: 'public',
        kind: 'react',
      },
      {
        name: 'leave-requests',
        title: 'Leave requests',
        path: '/leave-requests',
        federationName: 'intranet_leave_requests',
        package: '@org/intranet-leave-requests',
        access: 'private',
        kind: 'react',
      },
    ]);
    assert.deepEqual(readJson(root, `${shell}/mfe-manifest.dev.json`).remotes, {
      intranet_staff_directory: {
        entry: 'http://localhost:3110/mf-manifest.json',
      },
      intranet_leave_requests: {
        entry: 'http://localhost:3111/mf-manifest.json',
      },
    });
    assert.deepEqual(pkgA.nx.targets, {
      dev: {
        dependsOn: [{ projects: ['@org/mock-api'], target: 'serve:intranet' }],
      },
    });
    // standalone: the mock API in development only (dropped from production bundles)
    assert.match(
      read(root, 'apps/intranet/intranet/staff-directory/src/app/apps.tsx'),
      /process\.env\.NODE_ENV !== 'production'\s*\?\s*\{ apiBaseUrl: 'http:\/\/localhost:3190\/api' \}/,
    );
  });

  it('titles: sentence case with known acronyms, --title override', async () => {
    assert.equal(titleFromName('staff-directory'), 'Staff directory');
    assert.equal(titleFromName('it-helpdesk'), 'IT helpdesk');
    assert.equal(titleFromName('hr-faq'), 'HR FAQ');
    assert.equal(titleFromName('my-api-keys'), 'My API keys');
    const r = await generateRemote({
      root,
      zone: 'intranet',
      name: 'it-helpdesk',
      external: true,
    });
    assert.equal(r.entry.title, 'IT helpdesk');
    const t = await generateRemote({
      root,
      zone: 'intranet',
      name: 'hr-forms',
      title: '  Forms   for HR ',
    });
    assert.equal(t.entry.title, 'Forms for HR');
    assert.match(
      read(root, 'apps/intranet/intranet/hr-forms/src/core/constants/app.ts'),
      /APP_TITLE = 'Forms for HR'/,
    );
    for (const title of ["Bob's", 'a "b"', '<x>', '', 'x'.repeat(61)]) {
      await assert.rejects(
        generateRemote({ root, zone: 'intranet', name: 'bad-title', title }),
        /--title/,
        title,
      );
    }
    assert.ok(
      !fs.existsSync(path.join(root, 'apps/intranet/intranet/bad-title')),
    );
  });

  it('--state: feature state example (reducer + Context) used by two components', async () => {
    await assert.rejects(
      generateRemote({
        root,
        zone: 'intranet',
        name: 'no-state',
        external: true,
        state: true,
      }),
      /--state adds feature state to the demo feature of a React remote/,
    );
    await generateRemote({
      root,
      zone: 'intranet',
      name: 'team-board',
      state: true,
    });
    const dir = 'apps/intranet/intranet/team-board';
    const files = listFiles(path.join(root, dir));
    for (const f of [
      'src/features/demo/state/demoReducer.ts',
      'src/features/demo/state/demoReducer.test.ts',
      'src/features/demo/state/DemoContext.tsx',
      'src/features/demo/state/DemoContext.test.tsx',
      'src/features/demo/components/ItemPicker/ItemPicker.tsx',
      'src/features/demo/components/ItemPicker/ItemPicker.test.tsx',
      'src/features/demo/components/SelectionSummary/SelectionSummary.tsx',
      'src/features/demo/components/SelectionSummary/SelectionSummary.test.tsx',
    ]) {
      assert.ok(files.includes(f), `missing ${f}`);
    }
    const context = read(
      root,
      `${dir}/src/features/demo/state/DemoContext.tsx`,
    );
    // separate state and dispatch contexts; hooks throw outside the provider
    assert.match(context, /const DemoStateContext = createContext/);
    assert.match(context, /const DemoDispatchContext = createContext/);
    assert.match(context, /must be used inside <DemoProvider>/);
    assert.match(
      read(root, `${dir}/src/pages/OverviewPage/OverviewPage.tsx`),
      /<DemoProvider>/,
    );
    assert.match(
      read(root, `${dir}/src/features/demo/index.ts`),
      /export \{ DemoProvider \}/,
    );
    // without --state there is no state/ folder
    assert.ok(
      !listFiles(
        path.join(root, 'apps/intranet/intranet/staff-directory'),
      ).some((f) => f.includes('/state/')),
    );
  });

  it('remote layout: exposed module never imports global styles', () => {
    const dir = 'apps/intranet/intranet/staff-directory';
    const files = listFiles(path.join(root, dir));
    for (const f of [
      'src/app/apps.tsx',
      'src/app/apps.test.tsx',
      'src/app/routes.tsx',
      'src/components/ModeBadge/ModeBadge.tsx',
      'src/components/ModeBadge/ModeBadge.test.tsx',
      'src/features/demo/index.ts',
      'src/features/demo/components/Demo/Demo.tsx',
      'src/features/demo/components/Demo/Demo.module.scss',
      'src/features/demo/components/Demo/Demo.test.tsx',
      'src/features/demo/components/DemoDetails/DemoDetails.tsx',
      'src/features/demo/components/DemoDetails/DemoDetails.test.tsx',
      'src/features/demo/utils/validation.ts',
      'src/features/demo/api/itemsApi.ts',
      'src/features/demo/api/itemsApi.test.ts',
      'src/features/demo/hooks/useItems.ts',
      'src/features/demo/components/DemoItems/DemoItems.tsx',
      'src/features/demo/components/DemoItems/DemoItems.module.scss',
      'src/features/demo/components/AddItemForm/AddItemForm.tsx',
      'src/features/demo/components/AddItemForm/AddItemForm.module.scss',
      'src/features/demo/components/AddItemForm/AddItemForm.test.tsx',
      'src/layouts/StandaloneLayout/StandaloneLayout.tsx',
      'src/layouts/StandaloneLayout/StandaloneLayout.module.scss',
      'src/layouts/StandaloneLayout/StandaloneLayout.test.tsx',
      'src/pages/OverviewPage/OverviewPage.tsx',
      'src/pages/DetailsPage/DetailsPage.tsx',
      'src/core/constants/apiRoutes.ts',
      'public/index.html',
    ]) {
      assert.ok(files.includes(f), `missing ${f}`);
    }
    assert.match(read(root, `${dir}/webpack.config.js`), /createRemoteConfig/);
    assert.ok(!files.some((f) => f.startsWith('src/services/')));
    // page-level data fetching: the page calls the hooks, the components only display
    const overview = read(
      root,
      `${dir}/src/pages/OverviewPage/OverviewPage.tsx`,
    );
    assert.match(overview, /useItems\(\)/);
    assert.match(overview, /useCreateItem\(\)/);
    for (const c of ['Demo', 'DemoItems', 'AddItemForm', 'DemoDetails']) {
      assert.doesNotMatch(
        read(root, `${dir}/src/features/demo/components/${c}/${c}.tsx`),
        /=\s*use(Items|CreateItem|ApiClient)\(/,
        c,
      );
    }
    assert.match(
      read(root, `${dir}/src/features/demo/hooks/useItems.ts`),
      /import \{ useApiClient \} from '@org\/mf-runtime\/remote';/,
    );
    // the exposed module is src/app/apps.tsx (no RemoteApp.tsx / standaloneProps.ts)
    for (const f of ['src/app/RemoteApp.tsx', 'src/app/standaloneProps.ts']) {
      assert.ok(!files.includes(f), `${f} should not exist`);
    }
    assert.doesNotMatch(read(root, `${dir}/src/app/apps.tsx`), /global\.scss/);
    assert.match(read(root, `${dir}/src/main.tsx`), /global\.scss/);
    const apps = read(root, `${dir}/src/app/apps.tsx`);
    assert.match(apps, /^export default EmbeddedApp;$/m);
    assert.match(apps, /^export \{ StandaloneApp \};$/m);
    assert.match(
      read(root, `${dir}/src/app/apps.test.tsx`),
      /scanExposedModule\(/,
    );
  });

  it('no index.ts barrels except a feature root (the feature public API)', () => {
    for (const app of [
      'shell-intranet',
      'staff-directory',
      'leave-requests',
      'it-helpdesk',
    ]) {
      const dir = path.join(
        root,
        'apps',
        'intranet',
        'intranet',
        app === 'shell-intranet' ? 'shell' : app,
      );
      const barrels = listFiles(dir).filter((f) =>
        /(^|\/)index\.tsx?$/.test(f),
      );
      for (const f of barrels) {
        assert.match(f, /^src\/features\/[^/]+\/index\.ts$/, `${app}/${f}`);
      }
      assert.ok(barrels.length > 0, `${app} has a feature public API`);
    }
  });

  it('substitutes every template token', () => {
    for (const app of [
      'shell-intranet',
      'staff-directory',
      'leave-requests',
      'it-helpdesk',
      'team-board',
    ]) {
      const dir = path.join(
        root,
        'apps',
        'intranet',
        'intranet',
        app === 'shell-intranet' ? 'shell' : app,
      );
      for (const f of listFiles(dir)) {
        assert.doesNotMatch(
          fs.readFileSync(path.join(dir, f), 'utf8'),
          /__(?!MFE_)[A-Z][A-Z0-9_]*__/,
          `${app}/${f}`,
        );
        assert.ok(!f.endsWith('.tmpl'), f);
        // no app uses a shared layout component any more
        assert.doesNotMatch(
          fs.readFileSync(path.join(dir, f), 'utf8'),
          /MainLayout|useNavPlacement/,
          `${app}/${f}`,
        );
      }
    }
  });

  it('generates the internet zone and an external adapter remote', async () => {
    const s = await generateShell({ root, zone: 'internet', layout: 'side' });
    assert.equal(s.port, 3201);
    assert.equal(s.layout, 'side');
    const shellLayout = read(
      root,
      'apps/internet/internet/shell/src/layouts/ShellLayout/ShellLayout.tsx',
    );
    assert.match(shellLayout, /data-nav-placement="side"/);
    assert.match(shellLayout, /orientation="vertical"/);
    assert.doesNotMatch(shellLayout, /MainLayout|navPlacement=/);
    const sideStyles = read(
      root,
      'apps/internet/internet/shell/src/layouts/ShellLayout/ShellLayout.module.scss',
    );
    assert.match(sideStyles, /^\$sidebar-width: 16rem;$/m);
    assert.match(sideStyles, /HEADER COLOURS: change them here/);
    assert.match(
      read(
        root,
        'apps/internet/internet/shell/src/layouts/ShellLayout/ShellLayout.test.tsx',
      ),
      /sidebar when wide/,
    );
    // the starter differs only in src/layouts/ShellLayout: same e2e suite, package.json,
    // registry and manifest as a top-nav shell
    const intranetShell = path.join(root, 'apps/intranet/intranet/shell');
    const internetShell = path.join(root, 'apps/internet/internet/shell');
    for (const f of [
      'e2e/shell.spec.ts',
      'e2e/helpers.ts',
      'e2e/a11y.spec.ts',
    ]) {
      assert.equal(
        fs.readFileSync(path.join(internetShell, f), 'utf8'),
        fs
          .readFileSync(path.join(intranetShell, f), 'utf8')
          .replaceAll('Intranet shell', 'Internet shell')
          .replaceAll('intranet', 'internet'),
        f,
      );
    }
    assert.doesNotMatch(
      read(root, 'apps/internet/internet/shell/package.json'),
      /layout|side/i,
    );
    const r = await generateRemote({
      root,
      zone: 'internet',
      name: 'services',
    });
    assert.equal(r.port, 3210);
    const x = await generateRemote({
      root,
      zone: 'internet',
      name: 'payments',
      external: true,
    });
    assert.equal(x.port, 3211);
    assert.equal(x.entry.kind, 'external');
    const pkg = readJson(root, 'apps/internet/internet/payments/package.json');
    assert.deepEqual(pkg.nx.tags, [
      'zone:internet',
      'type:remote',
      'access:public',
      'kind:external',
    ]);
    const adapter = read(
      root,
      'apps/internet/internet/payments/src/features/external/components/ExternalModuleHost/ExternalModuleHost.tsx',
    );
    assert.match(adapter, /<ExternalModule/);
    assert.match(adapter, /@org\/mf-runtime\/external/);
    assert.doesNotMatch(adapter, /TODO/);
    assert.match(
      read(
        root,
        'apps/internet/internet/payments/src/pages/OverviewPage/OverviewPage.tsx',
      ),
      /ExternalModuleHost/,
    );
    // the vendor renders the pages: no demo feature / details page in an adapter
    const files = listFiles(path.join(root, 'apps/internet/internet/payments'));
    assert.ok(!files.some((f) => f.startsWith('src/features/demo/')));
    assert.ok(!files.includes('src/pages/DetailsPage/DetailsPage.tsx'));
    assert.ok(files.includes('src/features/external/utils/vendorConfig.ts'));
    assert.ok(
      files.includes(
        'src/features/external/components/ExternalModuleHost/ExternalModuleHost.test.tsx',
      ),
    );
    assert.ok(!files.includes('src/features/external/ExternalModuleHost.tsx'));
    // dev: the zone's mock API + mock vendor start with the adapter; the dev manifest points
    // at the internet mock vendor (tools range 3290-3299), generic config
    assert.deepEqual(pkg.nx.targets, {
      dev: {
        dependsOn: [
          { projects: ['@org/mock-api'], target: 'serve:internet' },
          { projects: ['@org/mock-vendor'], target: 'serve:internet' },
        ],
      },
    });
    const dev = readJson(
      root,
      'apps/internet/internet/shell/mfe-manifest.dev.json',
    );
    assert.deepEqual(dev.remotes.internet_payments.props.vendor, {
      url: 'http://localhost:3291/mount.js',
      format: 'esm',
      config: { title: 'Payments (mock vendor)' },
    });
    // the vendor props come from the shell's package.json mfe.devManifest (the file is generated)
    assert.deepEqual(
      readJson(root, 'apps/internet/internet/shell/package.json').mfe
        .devManifest.remotes.internet_payments,
      { props: { vendor: dev.remotes.internet_payments.props.vendor } },
    );
    assert.equal(
      readJson(root, 'apps/internet/internet/payments/package.json').scripts
        .dev,
      'webpack serve',
    );
    assert.equal(dev.remotes.internet_services.props, undefined);
    assert.equal(dev.settings.apiBaseUrl, '/api');
    const fallback = read(
      root,
      'apps/internet/internet/payments/src/features/external/utils/vendorConfig.ts',
    );
    assert.match(fallback, /http:\/\/localhost:3291\/mount\.js/);
    assert.doesNotMatch(fallback, /amount|merchant/i);
  });

  it('--vendor-format: web-component and script mock configs; mf and misuse refused', async () => {
    const wc = await generateRemote({
      root,
      zone: 'internet',
      name: 'widgets',
      external: true,
      vendorFormat: 'web-component',
    });
    const dev = readJson(
      root,
      'apps/internet/internet/shell/mfe-manifest.dev.json',
    );
    assert.deepEqual(dev.remotes[wc.federationName].props.vendor, {
      url: 'http://localhost:3291/element.js',
      format: 'web-component',
      tagName: 'mock-vendor-widget',
      config: { title: 'Widgets (mock vendor)' },
    });
    assert.match(
      read(
        root,
        'apps/internet/internet/widgets/src/features/external/utils/vendorConfig.ts',
      ),
      /tagName: 'mock-vendor-widget'/,
    );
    assert.deepEqual(mockVendorConfig('intranet', 'script', 'X'), {
      url: 'http://localhost:3191/script.js',
      format: 'script',
      global: 'MockVendor',
      config: { title: 'X (mock vendor)' },
    });
    await assert.rejects(
      generateRemote({
        root,
        zone: 'internet',
        name: 'fed',
        external: true,
        vendorFormat: 'mf',
      }),
      /cannot serve a Module Federation remote/,
    );
    await assert.rejects(
      generateRemote({
        root,
        zone: 'internet',
        name: 'fed',
        vendorFormat: 'esm',
      }),
      /only applies to --external/,
    );
    await assert.rejects(
      generateRemote({
        root,
        zone: 'internet',
        name: 'fed',
        external: true,
        vendorFormat: 'iframe',
      }),
      /Unknown --vendor-format/,
    );
    fs.rmSync(path.join(root, 'apps/internet/internet/widgets'), {
      recursive: true,
    });
    const regFile = path.join(
      root,
      'apps/internet/internet/shell/remotes.json',
    );
    const reg = JSON.parse(fs.readFileSync(regFile, 'utf8'));
    reg.remotes = reg.remotes.filter(
      (/** @type {any} */ e) => e.name !== 'widgets',
    );
    fs.writeFileSync(regFile, JSON.stringify(reg));
  });

  it('reuses the lowest free port', async () => {
    fs.rmSync(path.join(root, 'apps/internet/internet/services'), {
      recursive: true,
    });
    const shell = path.join(root, 'apps/internet/internet/shell/remotes.json');
    const reg = JSON.parse(fs.readFileSync(shell, 'utf8'));
    reg.remotes = reg.remotes.filter(
      (/** @type {any} */ e) => e.name !== 'services',
    );
    fs.writeFileSync(shell, JSON.stringify(reg));
    const r = await generateRemote({
      root,
      zone: 'internet',
      name: 'announcements',
    });
    assert.equal(r.port, 3210);
  });

  it('refuses existing names, stale registry entries and bad input', async () => {
    await assert.rejects(
      generateRemote({ root, zone: 'intranet', name: 'staff-directory' }),
      /already exists/,
    );
    // registry entry left behind without the folder
    const registryFile = path.join(
      root,
      'apps/internet/internet/shell/remotes.json',
    );
    const original = fs.readFileSync(registryFile, 'utf8');
    const reg = JSON.parse(original);
    reg.remotes.push({
      ...reg.remotes[0],
      name: 'ghost',
      path: '/ghost',
      federationName: 'internet_ghost',
    });
    fs.writeFileSync(registryFile, JSON.stringify(reg));
    await assert.rejects(
      generateRemote({ root, zone: 'internet', name: 'ghost' }),
      /already registered/,
    );
    assert.ok(!fs.existsSync(path.join(root, 'apps/internet/internet/ghost')));
    fs.writeFileSync(registryFile, original);
    for (const name of [
      'Bad',
      'a',
      '-x',
      'x--y',
      'x_y',
      'shell',
      'shell-two',
      '9lives',
    ]) {
      await assert.rejects(
        generateRemote({ root, zone: 'intranet', name }),
        /Invalid remote name/,
        name,
      );
    }
    await assert.rejects(
      generateShell({ root, zone: 'extranet' }),
      /Unknown zone/,
    );
    await assert.rejects(
      generateShell({ root, zone: 'intranet', layout: 'left' }),
      /Unknown --layout "left"\. Use one of: top, side\./,
    );
  });

  it('the generated workspace passes check-apps and check-versions', async () => {
    const apps = await checkApps({ root });
    assert.deepEqual(apps.errors, []);
    assert.deepEqual(apps.warnings, []);
    const versions = await checkVersions({ root });
    assert.deepEqual(versions.errors, []);
  });

  it('CLI: generates and reports errors without a stack trace', () => {
    const cliRoot = tempWorkspace();
    const out = execFileSync(
      process.execPath,
      [BIN, 'shell', 'internet', '--layout', 'side', '--root', cliRoot],
      {
        encoding: 'utf8',
      },
    );
    assert.match(out, /Created apps\/internet\/internet\/shell .*port 3201/);
    assert.match(out, /side starter layout in src\/layouts\/ShellLayout/);
    assert.match(
      read(
        cliRoot,
        'apps/internet/internet/shell/src/layouts/ShellLayout/ShellLayout.tsx',
      ),
      /data-nav-placement="side"/,
    );
    assert.match(out, /"Internet shell"/);
    const remote = execFileSync(
      process.execPath,
      [
        BIN,
        'remote',
        'internet',
        'my-profile',
        '--private',
        '--title',
        'Your profile',
        '--root',
        cliRoot,
      ],
      { encoding: 'utf8' },
    );
    assert.match(remote, /"Your profile"/);
    assert.match(remote, /port 3210, private/);
    assert.match(remote, /route \/my-profile\/\*/);
    let stderr = '';
    try {
      execFileSync(
        process.execPath,
        [BIN, 'remote', 'intranet', 'x1', '--root', cliRoot],
        {
          encoding: 'utf8',
          stdio: 'pipe',
        },
      );
      assert.fail('should exit non-zero');
    } catch (e) {
      stderr = /** @type {any} */ (e).stderr;
      assert.equal(/** @type {any} */ (e).status, 1);
    }
    assert.match(stderr, /^error: The intranet zone has no shell yet/);
    for (const [args, message] of /** @type {[string[], RegExp][]} */ ([
      [
        ['remote', 'internet', 'x2', '--layout', 'side'],
        /^error: --layout and --base-path apply to gen:shell only/,
      ],
      [
        ['shell', 'intranet', '--layout', 'left'],
        /^error: Unknown --layout "left"/,
      ],
    ])) {
      try {
        execFileSync(process.execPath, [BIN, ...args, '--root', cliRoot], {
          encoding: 'utf8',
          stdio: 'pipe',
        });
        assert.fail('should exit non-zero');
      } catch (e) {
        assert.equal(/** @type {any} */ (e).status, 1);
        assert.match(/** @type {any} */ (e).stderr, message);
      }
    }
    assert.doesNotMatch(stderr, /at .*\.js:\d+/);
  });
});

describe('generators: several shells in a zone', () => {
  /** @type {string} */
  let root;
  before(() => {
    root = tempWorkspace();
  });

  it('named shells under base paths; the first one becomes the default shell', async () => {
    const citizen = await generateShell({
      root,
      zone: 'internet',
      name: 'citizen',
      basePath: '/citizen',
      title: 'Citizen portal',
    });
    assert.equal(citizen.port, 3201);
    assert.equal(citizen.federationName, 'internet_shell_citizen');
    assert.equal(citizen.packageName, '@org/shell-citizen');
    assert.equal(citizen.defaultShell, true);
    const business = await generateShell({
      root,
      zone: 'internet',
      name: 'business',
      basePath: '/business/',
      layout: 'side',
    });
    assert.equal(business.port, 3202);
    assert.equal(business.basePath, '/business');
    assert.equal(business.title, 'Business shell');
    assert.equal(business.defaultShell, false);
    assert.equal(
      readJson(root, 'package.json').mfe.zones.internet.defaultShell,
      'citizen',
    );
    const pkg = readJson(root, 'apps/internet/business/shell/package.json');
    assert.equal(pkg.mfe.basePath, '/business');
    assert.match(
      read(root, 'apps/internet/business/shell/webpack.config.js'),
      /basePath: mfe\.basePath/,
    );
    assert.match(
      read(root, 'apps/internet/business/shell/src/app/App.tsx'),
      /<BrowserRouter basename=\{BASE_PATH\}>/,
    );
    assert.match(
      read(root, 'apps/internet/business/shell/src/main.tsx'),
      /loadMfeManifest\(\{ url: mfeManifestUrl\(BASE_PATH\) \}\)/,
    );
    assert.match(
      read(root, 'apps/internet/business/shell/README.md'),
      /http:\/\/localhost:3200\/business\//,
    );
    await assert.rejects(
      generateShell({
        root,
        zone: 'internet',
        name: 'xx',
        basePath: '/citizen/x',
      }),
      /overlaps the internet shell "citizen"/,
    );
    await assert.rejects(
      generateShell({ root, zone: 'internet', name: 'yy', basePath: 'Bad' }),
      /Invalid --base-path/,
    );
    await assert.rejects(
      generateShell({ root, zone: 'internet', name: 'Bad_Name' }),
      /Invalid shell name/,
    );
  });

  it('a remote names its shell(s) when the zone has several; one remote in two shells', async () => {
    await assert.rejects(
      generateRemote({ root, zone: 'internet', name: 'announcements' }),
      /has 2 shells \(business, citizen\).*--shell/,
    );
    await assert.rejects(
      generateRemote({
        root,
        zone: 'internet',
        name: 'announcements',
        shells: ['nope'],
      }),
      /--shell nope: no such internet shell/,
    );
    const shared = await generateRemote({
      root,
      zone: 'internet',
      name: 'announcements',
      shells: ['citizen,business'],
    });
    assert.equal(shared.port, 3210);
    assert.deepEqual(
      shared.shells.map((s) => s.url),
      [
        'http://localhost:3200/citizen/announcements',
        'http://localhost:3200/business/announcements',
      ],
    );
    const own = await generateRemote({
      root,
      zone: 'internet',
      name: 'licences',
      shells: ['business'],
      external: true,
    });
    const names = (/** @type {string} */ shell) =>
      readJson(root, `apps/internet/${shell}/shell/remotes.json`).remotes.map(
        (/** @type {any} */ r) => r.name,
      );
    assert.deepEqual(names('citizen'), ['announcements']);
    assert.deepEqual(names('business'), ['announcements', 'licences']);
    // the vendor dev config only goes to the shells that list the adapter
    assert.ok(
      readJson(root, 'apps/internet/business/shell/package.json').mfe
        .devManifest.remotes[own.federationName],
    );
    assert.equal(
      readJson(root, 'apps/internet/citizen/shell/package.json').mfe.devManifest
        .remotes,
      undefined,
    );
    assert.match(
      read(root, 'apps/internet/shared/announcements/README.md'),
      /http:\/\/localhost:3200\/citizen\/announcements/,
    );
    const r = await checkApps({ root });
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.warnings, []);
    // .env.example: the zone's lists the new remotes; the second shell got its own overrides file
    const zoneEnv = read(root, 'apps/internet/.env.example');
    assert.match(zoneEnv, /^# API_UPSTREAM=/m);
    assert.match(zoneEnv, /^# REMOTE_INTERNET_ANNOUNCEMENTS_URL=/m);
    assert.match(zoneEnv, /^# REMOTE_INTERNET_LICENCES_URL=/m);
    assert.ok(
      fs.existsSync(path.join(root, 'apps/internet/business/.env.example')) !==
        fs.existsSync(path.join(root, 'apps/internet/citizen/.env.example')),
      'only the second shell of the zone gets a shell-level .env.example',
    );
    assert.deepEqual((await checkEnv({ root })).errors, []);
  });

  it('CLI: gen:shell <zone> <name> --base-path, gen:remote --shell (repeated)', () => {
    const run = (/** @type {string[]} */ args) =>
      execFileSync(process.execPath, [BIN, ...args, '--root', root], {
        encoding: 'utf8',
      });
    const out = run(['shell', 'internet', 'agency', '--base-path', '/agency']);
    assert.match(out, /base path \/agency, port 3203/);
    const remote = run([
      'remote',
      'internet',
      'notices',
      '--shell',
      'citizen',
      '--shell',
      'agency',
    ]);
    assert.match(remote, /Registered with shell-citizen, shell-agency/);
  });
});

describe('generators: layout with arbitrary shell names (nothing hardcoded)', () => {
  /** @type {string} */
  let root;
  before(() => {
    root = tempWorkspace();
  });

  it('shells alpha and beta, an own remote each and a shared one', async () => {
    const alpha = await generateShell({
      root,
      zone: 'intranet',
      name: 'alpha',
      basePath: '/alpha',
    });
    assert.equal(alpha.dir, path.join(root, 'apps/intranet/alpha/shell'));
    assert.equal(alpha.packageName, '@org/shell-alpha');
    await generateShell({
      root,
      zone: 'intranet',
      name: 'beta',
      basePath: '/beta',
    });
    // a zone with several shells needs --shell
    await assert.rejects(
      generateRemote({ root, zone: 'intranet', name: 'only-alpha' }),
      /--shell/,
    );
    const own = await generateRemote({
      root,
      zone: 'intranet',
      name: 'only-alpha',
      shells: ['alpha'],
    });
    assert.equal(own.dir, path.join(root, 'apps/intranet/alpha/only-alpha'));
    const shared = await generateRemote({
      root,
      zone: 'intranet',
      name: 'both',
      shells: ['alpha', 'beta'],
    });
    assert.equal(shared.dir, path.join(root, 'apps/intranet/shared/both'));
    const betaOwn = await generateRemote({
      root,
      zone: 'intranet',
      name: 'only-beta',
      shells: ['beta'],
    });
    assert.equal(betaOwn.dir, path.join(root, 'apps/intranet/beta/only-beta'));
    // shell-level env example of the second shell sits in its group folder
    assert.ok(
      fs.existsSync(path.join(root, 'apps/intranet/beta/.env.example')),
    );
    const r = await checkApps({ root });
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.warnings, []);
  });

  it('one shell in the zone and no --shell: the remote goes to that shell group', async () => {
    const solo = tempWorkspace();
    await generateShell({ root: solo, zone: 'internet', name: 'gamma' });
    const r = await generateRemote({
      root: solo,
      zone: 'internet',
      name: 'solo',
    });
    assert.equal(r.dir, path.join(solo, 'apps/internet/gamma/solo'));
    assert.deepEqual((await checkApps({ root: solo })).errors, []);
  });

  it('"shared" is not a valid shell name', async () => {
    await assert.rejects(
      generateShell({ root, zone: 'internet', name: 'shared' }),
      /"shared" is reserved/,
    );
  });
});

describe('gen:package', () => {
  it('common: packages/common/<capability>, @org/common-<capability>, the public warning, passes every check', async () => {
    const root = tempWorkspace();
    const r = await generatePackage({
      root,
      target: 'common',
      capability: 'identity',
    });
    assert.equal(r.dir, path.join(root, 'packages/common/identity'));
    assert.equal(r.packageName, '@org/common-identity');
    assert.deepEqual(listFiles(r.dir).sort(), [
      'README.md',
      'eslint.config.js',
      'jest.config.js',
      'package.json',
      'src/index.ts',
      'src/styles.d.ts',
      'src/utils/formatLabel.test.ts',
      'src/utils/formatLabel.ts',
      'tsconfig.json',
    ]);
    const pkg = readJson(root, 'packages/common/identity/package.json');
    assert.deepEqual(pkg.nx, { tags: ['type:common'] });
    assert.equal(pkg.mfe, undefined);
    assert.equal(pkg.exports['.'], './src/index.ts');
    assert.equal(pkg.devDependencies['@org/eslint-config'], 'workspace:*');
    assert.equal(pkg.devDependencies['@org/jest-config'], 'workspace:*');
    assert.equal(pkg.devDependencies['@org/tsconfig'], 'workspace:*');
    for (const file of ['README.md', 'src/index.ts']) {
      assert.ok(
        read(root, `packages/common/identity/${file}`).includes(COMMON_WARNING),
        file,
      );
    }
    assert.equal(
      COMMON_WARNING,
      'Everything here ships to the internet portals. No confidential or intranet-only rules. The backend must enforce the same rules.',
    );
    assert.match(
      read(root, 'packages/common/identity/README.md'),
      /\]\(\.\.\/\.\.\/\.\.\/docs\/where-code-goes\.md\)/,
    );
    assert.deepEqual((await checkPackages({ root })).errors, []);
    assert.deepEqual((await checkVersions({ root })).errors, []);
  });

  it('zone: apps/<zone>/libs/<capability>, @org/<zone>-<capability>, no app, every check passes', async () => {
    const root = tempWorkspace();
    await generateShell({ root, zone: 'intranet' });
    await generateRemote({ root, zone: 'intranet', name: 'staff' });
    const r = await generatePackage({
      root,
      target: 'intranet',
      capability: 'staff-search',
    });
    assert.equal(r.dir, path.join(root, 'apps/intranet/libs/staff-search'));
    const pkg = readJson(root, 'apps/intranet/libs/staff-search/package.json');
    assert.equal(pkg.name, '@org/intranet-staff-search');
    assert.deepEqual(pkg.nx, { tags: ['zone:intranet', 'type:lib'] });
    const index = read(root, 'apps/intranet/libs/staff-search/src/index.ts');
    assert.match(
      index,
      /Never imported by the other zone or by packages\/common/,
    );
    assert.ok(!index.includes(COMMON_WARNING));
    assert.match(
      read(root, 'apps/intranet/libs/staff-search/README.md'),
      /pnpm move-component <app> <Name> --to intranet\/libs\/staff-search/,
    );
    for (const check of [checkApps, checkPackages, checkVersions, checkEnv]) {
      const result = await check({ root });
      assert.deepEqual(result.errors, [], check.name);
    }
    // not an app: no port taken, the next remote gets the next remote port
    const next = await generateRemote({
      root,
      zone: 'intranet',
      name: 'leave',
    });
    assert.equal(next.port, 3111);
  });

  it('refuses unknown targets, invalid and reserved names, existing folders and names', async () => {
    const root = tempWorkspace();
    await generateShell({ root, zone: 'internet' });
    await generateRemote({ root, zone: 'internet', name: 'services' });
    await generatePackage({ root, target: 'common', capability: 'identity' });
    /** @type {[string, string, RegExp][]} */
    const cases = [
      ['public', 'identity', /Unknown target "public"/],
      ['common', '', /Missing capability name/],
      ['common', 'Identity', /Invalid capability name/],
      ['common', 'a', /Invalid capability name/],
      ['common', 'two--dashes', /Invalid capability name/],
      ['common', 'x'.repeat(41), /Invalid capability name/],
      ['common', 'libs', /"libs" is reserved/],
      ['internet', 'shared', /"shared" is reserved/],
      ['internet', 'common', /"common" is reserved/],
      ['common', 'intranet', /"intranet" is reserved/],
      ['common', 'identity', /packages\/common\/identity already exists/],
      // the remote apps/internet/internet/services is @org/internet-services
      [
        'internet',
        'services',
        /@org\/internet-services is already used by apps\/internet\/internet\/services/,
      ],
    ];
    for (const [target, capability, error] of cases) {
      await assert.rejects(
        generatePackage({ root, target, capability }),
        error,
        `${target} ${capability}`,
      );
    }
  });

  it('arbitrary valid names generate packages that pass the checks', async () => {
    const root = tempWorkspace();
    const names = ['ab', 'a1', 'address-lookup', 'x9-y8-z7', 'p'.repeat(40)];
    for (const [i, capability] of names.entries()) {
      const target = ['common', 'intranet', 'internet'][i % 3];
      const r = await generatePackage({ root, target, capability });
      assert.equal(
        readJson(root, path.relative(root, path.join(r.dir, 'package.json')))
          .name,
        `@org/${target}-${capability}`,
      );
    }
    assert.deepEqual((await checkPackages({ root })).errors, []);
  });

  it('a remote cannot take the name of a zone library, and "libs" is no portal or remote name', async () => {
    const root = tempWorkspace();
    await generateShell({ root, zone: 'intranet' });
    await generatePackage({ root, target: 'intranet', capability: 'people' });
    await assert.rejects(
      generateRemote({ root, zone: 'intranet', name: 'people' }),
      /@org\/intranet-people is already used by apps\/intranet\/libs\/people/,
    );
    await assert.rejects(
      generateRemote({ root, zone: 'intranet', name: 'libs' }),
      /"libs" is reserved/,
    );
    await assert.rejects(
      generateShell({ root, zone: 'intranet', name: 'libs' }),
      /"libs" is reserved/,
    );
  });

  it('CLI: pnpm gen:package prints the next steps and refuses options', () => {
    const root = tempWorkspace();
    const out = execFileSync(
      process.execPath,
      [BIN, 'package', 'common', 'addresses', '--root', root],
      { encoding: 'utf8' },
    );
    assert.match(
      out,
      /Created packages\/common\/addresses \(@org\/common-addresses/,
    );
    assert.match(
      out,
      /pnpm move-component <app> <Component> --to common\/addresses/,
    );
    assert.throws(
      () =>
        execFileSync(
          process.execPath,
          [BIN, 'package', 'intranet', 'x2', '--private', '--root', root],
          { encoding: 'utf8', stdio: 'pipe' },
        ),
      /no options/,
    );
  });
});
