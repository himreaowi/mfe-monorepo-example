// @ts-check
/** Reading the workspace: existing apps, ports, the shell registry and dev manifest. */
import fs from 'node:fs';
import path from 'node:path';
import { ZONES, UsageError, shellNames } from './names.js';

/** @typedef {import('./names.js').Zone} Zone */

/**
 * @typedef {{
 *   name: string,
 *   title: string,
 *   path: string,
 *   federationName: string,
 *   package: string,
 *   access: 'public' | 'private',
 *   kind: 'react' | 'external',
 * }} RegistryEntry
 */

/** File in the shell that lists its remotes (nav + routes). Managed by gen:remote. */
export const REGISTRY_FILE = 'remotes.json';

/**
 * @param {string} file
 * @returns {any}
 */
export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * Every app (folder with a package.json) in `apps/<zone>/`.
 * @param {string} root
 * @param {Zone} zone
 * @returns {{ dir: string, pkg: any }[]}
 */
export function listZoneApps(root, zone) {
  const zoneDir = path.join(root, 'apps', zone);
  if (!fs.existsSync(zoneDir)) return [];
  return fs
    .readdirSync(zoneDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(zoneDir, d.name))
    .filter((dir) => fs.existsSync(path.join(dir, 'package.json')))
    .map((dir) => ({ dir, pkg: readJson(path.join(dir, 'package.json')) }));
}

/**
 * Every app in every zone.
 * @param {string} root
 */
export function listAllApps(root) {
  return /** @type {Zone[]} */ (Object.keys(ZONES)).flatMap((zone) =>
    listZoneApps(root, zone),
  );
}

/**
 * Lowest free dev port of the zone, skipping the shell's port (the zone's first port).
 * @param {string} root
 * @param {Zone} zone
 * @param {{ shell?: boolean }} [opts]
 * @returns {number}
 */
export function allocatePort(root, zone, opts = {}) {
  const { first, last } = ZONES[zone];
  const used = new Set(
    listAllApps(root)
      .map((a) => a.pkg?.mfe?.port)
      .filter((p) => Number.isInteger(p)),
  );
  if (opts.shell) {
    if (used.has(first)) {
      throw new UsageError(
        `Port ${first} (the ${zone} shell port) is already used by another app. Free it first.`,
      );
    }
    return first;
  }
  for (let port = first + 1; port <= last; port += 1) {
    if (!used.has(port)) return port;
  }
  throw new UsageError(
    `No free dev port left in the ${zone} range ${first}-${last}.`,
  );
}

/**
 * The zone's shell folder, or throw a helpful error if it was not generated yet.
 * @param {string} root
 * @param {Zone} zone
 */
export function requireShellDir(root, zone) {
  const dir = path.join(root, 'apps', zone, shellNames(zone).dirName);
  if (!fs.existsSync(path.join(dir, 'package.json'))) {
    throw new UsageError(
      `The ${zone} shell does not exist yet (expected apps/${zone}/${shellNames(zone).dirName}). Run "pnpm gen:shell ${zone}" first.`,
    );
  }
  return dir;
}

/**
 * @param {string} shellDir
 * @returns {{ remotes: RegistryEntry[] } & Record<string, unknown>}
 */
export function readRegistry(shellDir) {
  const file = path.join(shellDir, REGISTRY_FILE);
  if (!fs.existsSync(file)) return { remotes: [] };
  const json = readJson(file);
  if (!Array.isArray(json.remotes)) {
    throw new UsageError(`${file}: "remotes" must be an array.`);
  }
  return json;
}
