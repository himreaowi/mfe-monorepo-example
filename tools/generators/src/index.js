// @ts-check
/**
 * App generators.
 *
 *   pnpm gen:shell <zone>
 *   pnpm gen:remote <zone> <name> [--private] [--external]
 *
 * Apps live in apps/<zone>/<name>. Every app gets its own package.json (deps via `catalog:` /
 * `workspace:*`), Nx tags and a dev port from its zone's range.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  UsageError,
  ZONES,
  assertRemoteName,
  assertZone,
  remoteNames,
  shellNames,
} from './names.js';
import {
  DEV_MANIFEST_FILE,
  REGISTRY_FILE,
  allocatePort,
  listAllApps,
  readDevManifest,
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
 * }} o
 */
function appPackageJson(o) {
  return {
    name: o.packageName,
    version: '0.0.0',
    private: true,
    description: o.description,
    type: 'module',
    scripts: {
      dev: 'rspack dev',
      build: 'rspack build',
      preview: 'mfe-preview',
      lint: 'eslint .',
      typecheck: 'tsc -p tsconfig.json',
      test: 'jest',
    },
    nx: { tags: o.tags },
    mfe: { port: o.port, federationName: o.federationName },
    dependencies: sorted({
      ...APP_DEPENDENCIES,
      ...(o.extraDependencies ?? {}),
    }),
    devDependencies: sorted({
      ...APP_DEV_DEPENDENCIES,
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
 * @param {{ root: string, zone: string }} options
 * @returns {Promise<{ dir: string, port: number, packageName: string, federationName: string }>}
 */
export async function generateShell({ root, zone }) {
  assertZone(zone);
  const names = shellNames(zone);
  const dir = path.join(root, 'apps', zone, names.dirName);
  assertFree(root, dir, names.packageName);
  const port = allocatePort(root, zone, { shell: true });

  const files = await renderLayers(['shell'], dir, {
    ZONE: zone,
    APP_TITLE: names.title,
    PACKAGE_NAME: names.packageName,
    FEDERATION_NAME: names.federationName,
    PORT: port,
    DIR_NAME: names.dirName,
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
    }),
  );
  await writeJson(path.join(dir, REGISTRY_FILE), {
    $comment:
      'Remotes of this shell (nav + routes). Managed by `pnpm gen:remote`; edit title/path by hand if needed. URLs per environment live in mfe-manifest.json, not here.',
    remotes: [],
  });
  await writeJson(path.join(dir, DEV_MANIFEST_FILE), {
    remotes: {},
    // dev-only mock sign-in (@org/auth); production manifests list the BFF URLs instead
    auth: { mock: true },
    settings: {},
  });
  return {
    dir,
    port,
    packageName: names.packageName,
    federationName: names.federationName,
  };
}

/**
 * Generate apps/<zone>/<name> and register it with the zone's shell.
 * @param {{ root: string, zone: string, name: string, private?: boolean, external?: boolean }} options
 * @returns {Promise<{ dir: string, port: number, packageName: string, federationName: string, entry: RegistryEntry }>}
 */
export async function generateRemote({
  root,
  zone,
  name,
  private: isPrivate = false,
  external = false,
}) {
  assertZone(zone);
  assertRemoteName(name);
  const names = remoteNames(zone, name);
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

  const files = await renderLayers(
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
    },
  );
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

  const manifest = readDevManifest(shellDir);
  manifest.remotes[names.federationName] = {
    entry: `http://localhost:${port}/mf-manifest.json`,
  };
  await writeJson(path.join(shellDir, DEV_MANIFEST_FILE), manifest);

  return {
    dir,
    port,
    packageName: names.packageName,
    federationName: names.federationName,
    entry,
  };
}
