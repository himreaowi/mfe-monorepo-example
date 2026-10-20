// @ts-check
/**
 * App generators.
 *
 *   pnpm gen:shell <zone> [--layout top|side] [--title "<text>"]   (--layout: starter layout to copy)
 *   pnpm gen:remote <zone> <name> [--private] [--external [--vendor-format <format>]] [--title "<text>"]
 *
 * Apps live in apps/<zone>/<name>. Every app gets its own package.json (deps via `catalog:` /
 * `workspace:*`), Nx tags and a dev port from its zone's range.
 */
import fs from 'node:fs';
import path from 'node:path';
import { writeDevManifest } from '@org/scripts';
import { toolPort } from '@org/scripts/zones';
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
  readJson,
  readRegistry,
  requireShellDir,
} from './workspace.js';
import { renderLayers, writeFiles, writeJson } from './render.js';

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
  '@org/rspack-config': 'workspace:*',
  '@org/tsconfig': 'workspace:*',
  '@rspack/cli': 'catalog:',
  '@rspack/core': 'catalog:',
  '@rspack/dev-server': 'catalog:',
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
 *   nxTargets?: Record<string, unknown>, shell?: boolean,
 *   devManifest?: Record<string, unknown>,
 * }} o `devManifest` (shells): extra content of the generated mfe-manifest.dev.json
 */
function appPackageJson(o) {
  const scripts = {
    // a shell regenerates its mfe-manifest.dev.json first (remotes.json + remote ports)
    dev: o.shell
      ? 'mfe-dev-manifest --shell-dir . && rspack dev'
      : 'rspack dev',
    build: 'rspack build',
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
 * Generate apps/<zone>/shell-<zone>.
 * @param {{ root: string, zone: string, title?: string, layout?: string }} options `layout`:
 * the starter layout copied into src/layouts/ShellLayout (`top` default, `side`)
 * @returns {Promise<{ dir: string, port: number, packageName: string, federationName: string, title: string, layout: ShellLayout }>}
 */
export async function generateShell({ root, zone, title, layout = 'top' }) {
  assertZone(zone);
  assertShellLayout(layout);
  const names = shellNames(zone, { title });
  const dir = path.join(root, 'apps', zone, names.dirName);
  assertFree(root, dir, names.packageName);
  const port = allocatePort(root, zone, { shell: true });

  const files = await renderLayers(['shell', `shell-layouts/${layout}`], dir, {
    ZONE: zone,
    APP_TITLE: names.title,
    PACKAGE_NAME: names.packageName,
    FEDERATION_NAME: names.federationName,
    PORT: port,
    DIR_NAME: names.dirName,
    MOCK_API_URL: mockApiBaseUrl(zone, root),
    SHELL_LAYOUT: layout,
  });
  writeFiles(dir, files);
  await writeJson(
    path.join(dir, 'package.json'),
    appPackageJson({
      packageName: names.packageName,
      description: `${names.title}: host app of the ${zone} zone`,
      tags: [`zone:${zone}`, 'type:shell', 'access:public'],
      port,
      federationName: names.federationName,
      extraDependencies: { '@org/pwa': 'workspace:*' },
      // `nx dev <shell>` / `pnpm dev:<zone>` also start the zone's dev-only mock API
      nxTargets: devToolTargets(zone),
      shell: true,
      // extra content of the generated mfe-manifest.dev.json (pnpm dev-manifest): dev-only mock
      // sign-in (@org/auth) and the zone's mock API (tools/mock-api); production manifests list
      // the BFF URLs and the real API instead
      devManifest: {
        auth: { mock: true },
        settings: { apiBaseUrl: mockApiBaseUrl(zone, root) },
      },
    }),
  );
  await writeJson(path.join(dir, REGISTRY_FILE), {
    $comment:
      'Remotes of this shell (nav + routes). Managed by `pnpm gen:remote`; edit title/path by hand if needed. URLs per environment live in mfe-manifest.json, not here.',
    remotes: [],
  });
  writeDevManifest(root, dir);
  return {
    dir,
    port,
    packageName: names.packageName,
    federationName: names.federationName,
    title: names.title,
    layout,
  };
}

/**
 * Generate apps/<zone>/<name> and register it with the zone's shell.
 * @param {{
 *   root: string, zone: string, name: string, private?: boolean, external?: boolean,
 *   vendorFormat?: string, title?: string,
 * }} options `vendorFormat` (only with `external`): format of the dev mock vendor config
 * (`esm` default, `web-component`, `script`); `title`: overrides the title derived from the name
 * @returns {Promise<{ dir: string, port: number, packageName: string, federationName: string, entry: RegistryEntry }>}
 */
export async function generateRemote({
  root,
  zone,
  name,
  private: isPrivate = false,
  external = false,
  vendorFormat,
  title,
}) {
  assertZone(zone);
  assertRemoteName(name);
  if (vendorFormat !== undefined && !external) {
    throw new UsageError('--vendor-format only applies to --external remotes.');
  }
  const format = vendorFormat ?? 'esm';
  assertVendorFormat(format);
  const names = remoteNames(zone, name, { title });
  const shellDir = requireShellDir(root, zone);
  const dir = path.join(root, 'apps', zone, names.dirName);
  assertFree(root, dir, names.packageName);

  const registry = readRegistry(shellDir);
  if (
    registry.remotes.some(
      (r) =>
        r.name === name ||
        r.federationName === names.federationName ||
        r.path === names.routePath,
    )
  ) {
    throw new UsageError(
      `${name} is already registered in apps/${zone}/${path.basename(shellDir)}/${REGISTRY_FILE}. Remove the stale entry first.`,
    );
  }
  const port = allocatePort(root, zone);
  const access = isPrivate ? 'private' : 'public';
  const vendor = external
    ? mockVendorConfig(zone, format, names.title, root)
    : undefined;

  const rendered = await renderLayers(
    external ? ['remote', 'external'] : ['remote'],
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
      SHELL_PORT: ZONES[zone].first,
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
  registry.remotes.push(entry);
  await writeJson(path.join(shellDir, REGISTRY_FILE), registry);

  if (vendor) {
    // per-environment vendor config; dev points at the zone's mock vendor (tools/mock-vendor):
    // the shell's mfe.devManifest feeds the generated mfe-manifest.dev.json
    const shellPkgFile = path.join(shellDir, 'package.json');
    const shellPkg = readJson(shellPkgFile);
    shellPkg.mfe ??= {};
    shellPkg.mfe.devManifest ??= {};
    shellPkg.mfe.devManifest.remotes ??= {};
    shellPkg.mfe.devManifest.remotes[names.federationName] = {
      props: { vendor },
    };
    await writeJson(shellPkgFile, shellPkg);
  }
  writeDevManifest(root, shellDir);

  return {
    dir,
    port,
    packageName: names.packageName,
    federationName: names.federationName,
    entry,
  };
}
