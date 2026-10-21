// @ts-check
/**
 * App generators.
 *
 *   pnpm gen:shell <zone> [<name>] [--base-path /<path>] [--layout top|side] [--title "<text>"]
 *   pnpm gen:remote <zone> <name> [--shell <shell>[,<shell>]] [--private] [--state] [--external [--vendor-format <format>]] [--title "<text>"]
 *
 * Apps live in apps/<zone>/<name>. Every app gets its own package.json (deps via `catalog:` /
 * `workspace:*`), Nx tags and a dev port from its zone's range.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  ENV_EXAMPLE_FILE,
  renderShellEnvExample,
  syncZoneEnvExample,
  writeDevManifest,
} from '@org/scripts';
import {
  BASE_PATH,
  basePathsOverlap,
  shellBasePath,
  toolPort,
} from '@org/scripts/zones';
import {
  UsageError,
  ZONES,
  assertRemoteName,
  assertZone,
  remoteNames,
  shellNames,
} from './names.js';
import {
  REGISTRY_FILE,
  allocatePort,
  listAllApps,
  listShells,
  readJson,
  readRegistry,
  resolveShells,
} from './workspace.js';
import { renderLayers, writeFiles, writeJson } from './render.js';
import { SHELL_FOLDER, remoteTarget } from '@org/scripts/layout';

export * from './names.js';
export * from './workspace.js';

/** @typedef {import('./names.js').Zone} Zone */
/** @typedef {import('./workspace.js').RegistryEntry} RegistryEntry */

/** Runtime dependencies of every app. */
const APP_DEPENDENCIES = {
  // tier-1 singleton (session context); installed everywhere so it is always shared
  '@org/auth': 'workspace:*',
  '@org/design-tokens': 'workspace:*',
  '@org/http-client': 'workspace:*',
  '@org/mf-runtime': 'workspace:*',
  '@org/ui': 'workspace:*',
  react: 'catalog:',
  'react-dom': 'catalog:',
  'react-router': 'catalog:',
};

/** Build/test/lint tooling of every app. */
const APP_DEV_DEPENDENCIES = {
  '@org/eslint-config': 'workspace:*',
  '@org/jest-config': 'workspace:*',
  '@org/tsconfig': 'workspace:*',
  '@org/webpack-config': 'workspace:*',
  webpack: 'catalog:',
  'webpack-cli': 'catalog:',
  'webpack-dev-server': 'catalog:',
  '@testing-library/dom': 'catalog:',
  '@testing-library/jest-dom': 'catalog:',
  '@testing-library/react': 'catalog:',
  '@testing-library/user-event': 'catalog:',
  '@types/jest': 'catalog:',
  '@types/node': 'catalog:',
  '@types/react': 'catalog:',
  '@types/react-dom': 'catalog:',
  eslint: 'catalog:',
  jest: 'catalog:',
  prettier: 'catalog:',
  typescript: 'catalog:',
};

/** Extra tooling of a shell: the zone's e2e suite (Playwright + axe, @org/playwright-config). */
const SHELL_DEV_DEPENDENCIES = {
  '@axe-core/playwright': 'catalog:',
  '@org/playwright-config': 'workspace:*',
  '@playwright/test': 'catalog:',
};

/** Files of the `remote` layer that an `--external` adapter does not need (the vendor renders the pages). */
const EXTERNAL_OMIT = [
  'src/features/demo/',
  'src/pages/DetailsPage/',
  'src/pages/NotFoundPage/',
  'src/core/constants/routePaths.ts',
];

/** Dev-only mock vendor (tools/mock-vendor): one server per zone, port from the zone's tools range. */
export const MOCK_VENDOR = { package: '@org/mock-vendor' };

/** Dev-only mock API (tools/mock-api): one server per zone, port from the zone's tools range. */
export const MOCK_API = { package: '@org/mock-api' };

/** `--vendor-format` values the mock vendor can serve (format `mf` needs a real MF remote). */
export const VENDOR_FORMATS = /** @type {const} */ ([
  'esm',
  'web-component',
  'script',
]);

/** @typedef {(typeof VENDOR_FORMATS)[number]} VendorFormat */

/**
 * `gen:shell --layout` values: which starter layout is copied into the shell as its own code
 * (`templates/shell-layouts/<layout>` → `src/layouts/ShellLayout/`). `top` (default): nav in
 * the header row; `side`: nav in a sidebar left of the content. Both collapse behind "Menu"
 * on narrow screens. After generation there is no layout option: the team edits the files.
 */
export const SHELL_LAYOUTS = /** @type {const} */ (['top', 'side']);

/** @typedef {(typeof SHELL_LAYOUTS)[number]} ShellLayout */

/**
 * @param {unknown} layout
 * @returns {asserts layout is ShellLayout}
 */
function assertShellLayout(layout) {
  if (!SHELL_LAYOUTS.includes(/** @type {ShellLayout} */ (layout))) {
    throw new UsageError(
      `Unknown --layout "${String(layout)}". Use one of: ${SHELL_LAYOUTS.join(', ')}.`,
    );
  }
}

/** `settings.apiBaseUrl` of a zone's dev manifest: the zone's mock API. */
export function mockApiBaseUrl(
  /** @type {Zone} */ zone,
  /** @type {string | undefined} */ root = undefined,
) {
  return `http://localhost:${toolPort(zone, 'mockApi', root)}/api`;
}

/**
 * `settings.apiBaseUrl` of a shell's dev manifest: its same-origin API path on the zone's dev
 * proxy (`/api`, `/citizen/api`). The proxy forwards it to `API_UPSTREAM` (the zone's mock API
 * unless a .env says otherwise), exactly like nginx does in production.
 * @param {string} basePath
 */
export function shellApiBaseUrl(basePath) {
  return `${basePath === '/' ? '' : basePath}/api`;
}

/**
 * Create / update apps/<zone>/.env.example so it documents every remote the zone's shells
 * register (`pnpm check`, check-env).
 * @param {string} root
 * @param {Zone} zone
 */
function syncEnvExample(root, zone) {
  const remotes = [
    ...new Set(
      listShells(root, zone).flatMap((s) =>
        readRegistry(s.dir).remotes.map((r) => r.federationName),
      ),
    ),
  ];
  syncZoneEnvExample({
    root,
    zone,
    mockApiUrl: mockApiBaseUrl(zone, root),
    remotes,
  });
}

/**
 * Manifest `props.vendor` pointing at the zone's mock vendor in the given format.
 * `config` is generic (shown by the mock vendor); a real vendor documents its own.
 * @param {Zone} zone
 * @param {VendorFormat} format
 * @param {string} title
 * @param {string} [root] workspace whose root package.json declares the tool ports (`mfe.tools`)
 */
export function mockVendorConfig(zone, format, title, root) {
  const origin = `http://localhost:${toolPort(zone, 'mockVendor', root)}`;
  const config = { title: `${title} (mock vendor)` };
  switch (format) {
    case 'web-component':
      return {
        url: `${origin}/element.js`,
        format,
        tagName: 'mock-vendor-widget',
        config,
      };
    case 'script':
      return {
        url: `${origin}/script.js`,
        format,
        global: 'MockVendor',
        config,
      };
    default:
      return { url: `${origin}/mount.js`, format: 'esm', config };
  }
}

/**
 * @param {unknown} format
 * @returns {asserts format is VendorFormat}
 */
function assertVendorFormat(format) {
  if (format === 'mf') {
    throw new UsageError(
      '--vendor-format mf: the mock vendor cannot serve a Module Federation remote. Generate with the default (esm) and set "format": "mf", "remoteName" and the vendor URL in props.vendor of mfe-manifest.json (docs/external-modules.md).',
    );
  }
  if (!VENDOR_FORMATS.includes(/** @type {VendorFormat} */ (format))) {
    throw new UsageError(
      `Unknown --vendor-format "${String(format)}". Use one of: ${VENDOR_FORMATS.join(', ')}.`,
    );
  }
}

/**
 * Nx `dev` dependencies: the zone's dev-only tool servers start with the app
 * (`pnpm dev:<zone>`, `pnpm exec nx dev <app>`).
 * @param {Zone} zone
 * @param {{ vendor?: boolean }} [opts]
 */
function devToolTargets(zone, opts = {}) {
  return {
    dev: {
      dependsOn: [
        { projects: [MOCK_API.package], target: `serve:${zone}` },
        ...(opts.vendor
          ? [{ projects: [MOCK_VENDOR.package], target: `serve:${zone}` }]
          : []),
      ],
    },
  };
}

/**
 * @param {Record<string, string>} obj
 * @returns {Record<string, string>}
 */
function sorted(obj) {
  return Object.fromEntries(
    Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)),
  );
}

/**
 * @param {{
 *   packageName: string, description: string, tags: string[], port: number,
 *   federationName: string, extraDependencies?: Record<string, string>,
 *   nxTargets?: Record<string, unknown>, shell?: boolean, basePath?: string,
 *   devManifest?: Record<string, unknown>,
 * }} o `devManifest` (shells): extra content of the generated mfe-manifest.dev.json;
 *   `basePath` (shells): where the shell is served
 */
function appPackageJson(o) {
  const scripts = {
    // a shell regenerates its mfe-manifest.dev.json first (remotes.json + remote ports)
    dev: o.shell
      ? 'mfe-dev-manifest --shell-dir . && webpack serve'
      : 'webpack serve',
    build: 'webpack build',
    preview: 'mfe-preview',
    lint: 'eslint .',
    typecheck: o.shell
      ? 'tsc -p tsconfig.json && tsc -p e2e/tsconfig.json'
      : 'tsc -p tsconfig.json',
    test: 'jest',
    // the zone's e2e suite lives in the shell (pnpm e2e:<zone> from the repo root)
    ...(o.shell ? { e2e: 'playwright test' } : {}),
  };
  return {
    name: o.packageName,
    version: '0.0.0',
    private: true,
    description: o.description,
    type: 'module',
    scripts,
    nx: o.nxTargets ? { tags: o.tags, targets: o.nxTargets } : { tags: o.tags },
    mfe: {
      port: o.port,
      federationName: o.federationName,
      ...(o.basePath ? { basePath: o.basePath } : {}),
      ...(o.devManifest ? { devManifest: o.devManifest } : {}),
    },
    dependencies: sorted({
      ...APP_DEPENDENCIES,
      ...(o.extraDependencies ?? {}),
    }),
    devDependencies: sorted({
      ...APP_DEV_DEPENDENCIES,
      ...(o.shell ? SHELL_DEV_DEPENDENCIES : {}),
      '@org/scripts': 'workspace:*',
    }),
  };
}

/**
 * Refuse to write into an existing folder, or to reuse a package name.
 * @param {string} root
 * @param {string} dir
 * @param {string} packageName
 */
function assertFree(root, dir, packageName) {
  if (fs.existsSync(dir)) {
    throw new UsageError(
      `${path.relative(root, dir)} already exists. Generators never overwrite; delete it first or pick another name.`,
    );
  }
  const clash = listAllApps(root).find((a) => a.pkg?.name === packageName);
  if (clash) {
    throw new UsageError(
      `Package name ${packageName} is already used by ${path.relative(root, clash.dir)}.`,
    );
  }
}

/**
 * Generate apps/<zone>/<name>/shell (default name: the zone).
 * @param {{ root: string, zone: string, name?: string, basePath?: string, title?: string, layout?: string }} options
 *   `basePath`: where the shell is served (`/` default, e.g. `/citizen`; every shell of a zone
 *   needs its own, none inside another); `layout`: the starter layout copied into
 *   src/layouts/ShellLayout (`top` default, `side`)
 * @returns {Promise<{ dir: string, port: number, packageName: string, federationName: string, title: string, layout: ShellLayout, basePath: string, defaultShell: boolean }>}
 *   `defaultShell`: the root package.json now redirects the zone's `/` to this shell
 */
export async function generateShell({
  root,
  zone,
  name,
  basePath: rawBasePath,
  title,
  layout = 'top',
}) {
  assertZone(zone);
  assertShellLayout(layout);
  const names = shellNames(zone, { name, title });
  const basePath = shellBasePath(rawBasePath);
  if (!BASE_PATH.test(basePath)) {
    throw new UsageError(
      `Invalid --base-path "${rawBasePath}". Use "/" or a path like /citizen (lowercase letters, digits and "-" per segment).`,
    );
  }
  const dir = path.join(root, 'apps', zone, names.groupName, names.dirName);
  assertFree(root, dir, names.packageName);
  const existing = listShells(root, zone);
  const clash = existing.find((s) => basePathsOverlap(s.basePath, basePath));
  if (clash) {
    throw new UsageError(
      `Base path ${basePath} overlaps the ${zone} shell "${clash.name}" (${clash.basePath}). Shells of a zone share one origin: pass --base-path /<another path>.`,
    );
  }
  const port = allocatePort(root, zone, { shell: true });

  const files = await renderLayers(['shell', `shell-layouts/${layout}`], dir, {
    ZONE: zone,
    APP_TITLE: names.title,
    PACKAGE_NAME: names.packageName,
    FEDERATION_NAME: names.federationName,
    PORT: port,
    DIR_NAME: names.dirName,
    SHELL_NAME: names.name,
    BASE_PATH: basePath,
    SHELL_URL: shellUrl(zone, basePath),
    BASE_PREFIX: basePath === '/' ? '' : `${basePath}/`,
    API_PATH: shellApiBaseUrl(basePath),
    SHELL_LAYOUT: layout,
  });
  writeFiles(dir, files);
  await writeJson(
    path.join(dir, 'package.json'),
    appPackageJson({
      packageName: names.packageName,
      description: `${names.title}: host app of the ${zone} zone${basePath === '/' ? '' : ` at ${basePath}`}`,
      tags: [`zone:${zone}`, 'type:shell', 'access:public'],
      port,
      federationName: names.federationName,
      basePath,
      extraDependencies: { '@org/pwa': 'workspace:*' },
      // `nx dev <shell>` / `pnpm dev:<zone>` also start the zone's dev-only mock API
      nxTargets: devToolTargets(zone),
      shell: true,
      // extra content of the generated mfe-manifest.dev.json (pnpm dev-manifest): dev-only mock
      // sign-in (@org/auth; "mockUser" picks the fake user) and the zone's mock API
      // (tools/mock-api); production manifests list the BFF URLs and the real API instead
      devManifest: {
        auth: { mock: true },
        settings: { apiBaseUrl: shellApiBaseUrl(basePath) },
      },
    }),
  );
  await writeJson(path.join(dir, REGISTRY_FILE), {
    $comment:
      'Remotes of this shell (nav + routes). Managed by `pnpm gen:remote`; edit title/path by hand if needed. URLs per environment live in mfe-manifest.json, not here.',
    remotes: [],
  });
  writeDevManifest(root, dir);
  // .env.example: the zone's (created if missing) and, when the zone has other shells that may
  // use other backends, this shell's own overrides
  syncEnvExample(root, zone);
  if (existing.length > 0) {
    fs.writeFileSync(
      path.join(path.dirname(dir), ENV_EXAMPLE_FILE),
      renderShellEnvExample({ zone, name: names.name, basePath }),
    );
  }

  // no shell at "/" in the zone: the zone's "/" (dev proxy, deploy example) redirects to the
  // first shell below a base path, set in the root package.json (mfe.zones.<zone>.defaultShell)
  let defaultShell = false;
  if (basePath !== '/' && !existing.some((s) => s.basePath === '/')) {
    const rootFile = path.join(root, 'package.json');
    const rootPkg = readJson(rootFile);
    if (rootPkg.mfe?.zones?.[zone]?.defaultShell === undefined) {
      rootPkg.mfe ??= {};
      rootPkg.mfe.zones ??= {};
      rootPkg.mfe.zones[zone] = {
        ...(rootPkg.mfe.zones[zone] ?? {}),
        defaultShell: names.name,
      };
      await writeJson(rootFile, rootPkg);
      defaultShell = true;
    }
  }
  return {
    dir,
    port,
    packageName: names.packageName,
    federationName: names.federationName,
    title: names.title,
    layout,
    basePath,
    defaultShell,
  };
}

/**
 * URL of a shell (through the zone's dev proxy), without trailing slash:
 * `http://localhost:3100`, `http://localhost:3200/citizen`.
 * @param {Zone} zone
 * @param {string} basePath
 */
export function shellUrl(zone, basePath) {
  return `http://localhost:${ZONES[zone].proxy}${basePath === '/' ? '' : basePath}`;
}

/**
 * Generate apps/<zone>/<shell>/<name> (apps/<zone>/shared/<name> when several shells list it) and register it with shells of its zone (`shells`: shell names;
 * default: the zone's only shell, required when the zone has several).
 * @param {{
 *   root: string, zone: string, name: string, shells?: string[], private?: boolean,
 *   external?: boolean, vendorFormat?: string, title?: string, state?: boolean,
 * }} options `vendorFormat` (only with `external`): format of the dev mock vendor config
 * (`esm` default, `web-component`, `script`); `title`: overrides the title derived from the name;
 * `state`: add the feature-state example (`features/demo/state/`: reducer + Context, used by
 * ItemPicker and SelectionSummary on the overview page; templates/remote-state)
 * @returns {Promise<{ dir: string, port: number, packageName: string, federationName: string, entry: RegistryEntry, shells: { name: string, url: string }[] }>}
 */
export async function generateRemote({
  root,
  zone,
  name,
  shells: shellOption = [],
  private: isPrivate = false,
  external = false,
  vendorFormat,
  title,
  state = false,
}) {
  assertZone(zone);
  assertRemoteName(name);
  if (state && external) {
    throw new UsageError(
      '--state adds feature state to the demo feature of a React remote; an --external adapter has none (the vendor owns its state).',
    );
  }
  if (vendorFormat !== undefined && !external) {
    throw new UsageError('--vendor-format only applies to --external remotes.');
  }
  const format = vendorFormat ?? 'esm';
  assertVendorFormat(format);
  const names = remoteNames(zone, name, { title });
  const shells = resolveShells(root, zone, shellOption);
  // one shell lists it → that shell's group folder; two or more → apps/<zone>/shared
  const target = /** @type {NonNullable<ReturnType<typeof remoteTarget>>} */ (
    remoteTarget(
      zone,
      names.dirName,
      shells.map((s) => s.name),
    )
  );
  const dir = path.join(root, target.dir);
  assertFree(root, dir, names.packageName);

  for (const shell of shells) {
    const registry = readRegistry(shell.dir);
    if (
      registry.remotes.some(
        (r) =>
          r.name === name ||
          r.federationName === names.federationName ||
          r.path === names.routePath,
      )
    ) {
      throw new UsageError(
        `${name} is already registered in apps/${zone}/${shell.name}/${SHELL_FOLDER}/${REGISTRY_FILE}. Remove the stale entry first.`,
      );
    }
  }
  const port = allocatePort(root, zone);
  const access = isPrivate ? 'private' : 'public';
  const vendor = external
    ? mockVendorConfig(zone, format, names.title, root)
    : undefined;

  const rendered = await renderLayers(
    external
      ? ['remote', 'external']
      : state
        ? ['remote', 'remote-state']
        : ['remote'],
    dir,
    {
      ZONE: zone,
      NAME: name,
      APP_TITLE: names.title,
      PACKAGE_NAME: names.packageName,
      FEDERATION_NAME: names.federationName,
      ROUTE_PATH: names.routePath,
      PORT: port,
      ACCESS: access,
      SHELL_URL: shellUrl(zone, shells[0].basePath),
      MOCK_API_URL: mockApiBaseUrl(zone, root),
      MOCK_VENDOR_PORT: toolPort(zone, 'mockVendor', root),
      MOCK_VENDOR_URL: vendor?.url ?? '',
      MOCK_VENDOR_CONFIG: JSON.stringify(vendor ?? null),
      VENDOR_FORMAT: format,
    },
  );
  const files = external
    ? new Map(
        [...rendered].filter(
          ([rel]) => !EXTERNAL_OMIT.some((omit) => rel.startsWith(omit)),
        ),
      )
    : rendered;
  writeFiles(dir, files);
  const tags = [`zone:${zone}`, 'type:remote', `access:${access}`];
  if (external) tags.push('kind:external');
  await writeJson(
    path.join(dir, 'package.json'),
    appPackageJson({
      packageName: names.packageName,
      description: `${names.title}: ${external ? 'external module adapter' : 'remote'} of the ${zone} zone (${access})`,
      tags,
      port,
      federationName: names.federationName,
      // `nx dev <remote>` / `pnpm dev:<zone>` also start the zone's mock API (+ mock vendor)
      nxTargets: devToolTargets(zone, { vendor: external }),
    }),
  );

  /** @type {RegistryEntry} */
  const entry = {
    name,
    title: names.title,
    path: names.routePath,
    federationName: names.federationName,
    package: names.packageName,
    access,
    kind: external ? 'external' : 'react',
  };
  for (const shell of shells) {
    const registry = readRegistry(shell.dir);
    registry.remotes.push(entry);
    await writeJson(path.join(shell.dir, REGISTRY_FILE), registry);

    if (vendor) {
      // per-environment vendor config; dev points at the zone's mock vendor (tools/mock-vendor):
      // the shell's mfe.devManifest feeds the generated mfe-manifest.dev.json
      const shellPkgFile = path.join(shell.dir, 'package.json');
      const shellPkg = readJson(shellPkgFile);
      shellPkg.mfe ??= {};
      shellPkg.mfe.devManifest ??= {};
      shellPkg.mfe.devManifest.remotes ??= {};
      shellPkg.mfe.devManifest.remotes[names.federationName] = {
        props: { vendor },
      };
      await writeJson(shellPkgFile, shellPkg);
    }
    writeDevManifest(root, shell.dir);
  }
  syncEnvExample(root, zone);

  return {
    dir,
    port,
    packageName: names.packageName,
    federationName: names.federationName,
    entry,
    shells: shells.map((s) => ({
      name: s.name,
      url: `${shellUrl(zone, s.basePath)}${names.routePath}`,
    })),
  };
}
