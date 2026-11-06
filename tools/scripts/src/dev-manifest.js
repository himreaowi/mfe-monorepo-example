// @ts-check
/**
 * A shell's `mfe-manifest.dev.json` (served as /mfe-manifest.json by its dev server) is
 * GENERATED, never edited by hand:
 *
 * - `remotes`: one entry per remote in the shell's `remotes.json`, in registry order, pointing at
 *   the remote's dev server: `http://localhost:<remote package.json mfe.port>/mf-manifest.json`;
 * - everything else (`auth`, `settings`, per-remote dev `props` such as an external adapter's
 *   `vendor`) comes from the shell's package.json `mfe.devManifest`:
 *
 *     "mfe": {
 *       "port": 3100, "federationName": "intranet_shell",
 *       "devManifest": {
 *         "auth": { "mock": true },
 *         "settings": { "apiBaseUrl": "http://localhost:3190/api" },
 *         "remotes": { "intranet_it_helpdesk": { "props": { "vendor": { … } } } }
 *       }
 *     }
 *
 * Written by the generators, by the shell's `dev` script (`mfe-dev-manifest`), by `pnpm e2e` and
 * by `pnpm dev-manifest`; `pnpm check` fails when the committed file is out of date.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadApps, readJson } from './workspace.js';

/** File in a shell served as /mfe-manifest.json by its dev server. */
export const DEV_MANIFEST_FILE = 'mfe-manifest.dev.json';
/** The shell's registry of remotes (nav + routes). */
export const REGISTRY_FILE = 'remotes.json';

/**
 * @param {unknown} value
 * @returns {value is Record<string, any>}
 */
function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The dev manifest a shell should have.
 * @param {string} root workspace root
 * @param {string} shellDir absolute path of the shell
 * @returns {{ manifest: Record<string, unknown>, problems: string[] }} `problems`: registry entries
 *   that could not be resolved (left out of the manifest; `pnpm check` reports them in detail)
 */
export function buildDevManifest(root, shellDir) {
  /** @type {string[]} */
  const problems = [];
  const shellPkg = readJson(path.join(shellDir, 'package.json'));
  const devManifest = isObject(shellPkg.mfe?.devManifest)
    ? shellPkg.mfe.devManifest
    : {};
  const { remotes: remoteOverrides, ...rest } = devManifest;
  const registryFile = path.join(shellDir, REGISTRY_FILE);
  const registry = fs.existsSync(registryFile) ? readJson(registryFile) : {};
  const entries = Array.isArray(registry.remotes) ? registry.remotes : [];
  const byName = new Map(loadApps(root).map((app) => [app.name, app]));

  /** @type {Record<string, Record<string, unknown>>} */
  const remotes = {};
  for (const entry of entries) {
    const federationName = entry?.federationName;
    const app = byName.get(entry?.package);
    const port = app?.pkg.mfe?.port;
    if (typeof federationName !== 'string' || !Number.isInteger(port)) {
      problems.push(
        `${entry?.name ?? '(unnamed)'}: package ${entry?.package} has no mfe.port`,
      );
      continue;
    }
    const override = isObject(remoteOverrides)
      ? remoteOverrides[federationName]
      : undefined;
    remotes[federationName] = {
      entry: `http://localhost:${port}/mf-manifest.json`,
      ...(isObject(override) ? override : {}),
    };
  }
  return { manifest: { remotes, ...rest }, problems };
}

/** Text of a generated dev manifest (2-space JSON, trailing newline). */
export function formatDevManifest(/** @type {unknown} */ manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/**
 * Every shell folder (package.json tag `type:shell`) of the workspace.
 * @param {string} root
 * @returns {string[]} absolute paths
 */
export function shellDirs(root) {
  return loadApps(root)
    .filter(
      (app) =>
        Array.isArray(app.pkg.nx?.tags) &&
        app.pkg.nx.tags.includes('type:shell'),
    )
    .map((app) => path.join(root, app.dir));
}

/**
 * (Re)write a shell's mfe-manifest.dev.json. The file is only touched when its content changes
 * (a running dev server is not disturbed).
 * @param {string} root
 * @param {string} shellDir absolute
 * @returns {{ file: string, changed: boolean, problems: string[] }}
 */
export function writeDevManifest(root, shellDir) {
  const { manifest, problems } = buildDevManifest(root, shellDir);
  const file = path.join(shellDir, DEV_MANIFEST_FILE);
  const text = formatDevManifest(manifest);
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (current === text) return { file, changed: false, problems };
  fs.writeFileSync(file, text);
  return { file, changed: true, problems };
}

/**
 * Is the shell's committed dev manifest what `buildDevManifest` produces? Compares the JSON
 * content (formatting does not matter).
 * @param {string} root
 * @param {string} shellDir absolute
 * @returns {{ upToDate: boolean, missing: boolean, invalid?: string }}
 */
export function devManifestStatus(root, shellDir) {
  const file = path.join(shellDir, DEV_MANIFEST_FILE);
  if (!fs.existsSync(file)) return { upToDate: false, missing: true };
  let current;
  try {
    current = readJson(file);
  } catch (error) {
    return {
      upToDate: false,
      missing: false,
      invalid: /** @type {Error} */ (error).message,
    };
  }
  const { manifest } = buildDevManifest(root, shellDir);
  return {
    upToDate: JSON.stringify(current) === JSON.stringify(manifest),
    missing: false,
  };
}
