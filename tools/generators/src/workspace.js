// @ts-check
/** Reading the workspace: existing apps, ports, the shell registry and dev manifest. */
import fs from 'node:fs';
import path from 'node:path';
import { ZONES, UsageError } from './names.js';

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
 * Lowest free dev port of the zone's shells range (x01-x09) or remotes range (x10-x89).
 * @param {string} root
 * @param {Zone} zone
 * @param {{ shell?: boolean }} [opts]
 * @returns {number}
 */
export function allocatePort(root, zone, opts = {}) {
  const { first, last } = opts.shell ? ZONES[zone].shells : ZONES[zone].remotes;
  const used = new Set(
    listAllApps(root)
      .map((a) => a.pkg?.mfe?.port)
      .filter((p) => Number.isInteger(p)),
  );
  for (let port = first; port <= last; port += 1) {
    if (!used.has(port)) return port;
  }
  throw new UsageError(
    `No free dev port left in the ${zone} ${opts.shell ? 'shells' : 'remotes'} range ${first}-${last}.`,
  );
}

/**
 * @typedef {{ name: string, dir: string, pkg: any, basePath: string }} ShellInfo
 */

/**
 * The shells of a zone (apps/<zone>/shell-<name>), sorted by name.
 * @param {string} root
 * @param {Zone} zone
 * @returns {ShellInfo[]}
 */
export function listShells(root, zone) {
  return listZoneApps(root, zone)
    .filter((a) => path.basename(a.dir).startsWith('shell-'))
    .map((a) => ({
      name: path.basename(a.dir).slice('shell-'.length),
      dir: a.dir,
      pkg: a.pkg,
      basePath: String(a.pkg?.mfe?.basePath ?? '/').replace(/\/+$/, '') || '/',
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The shells a new remote is registered with: `--shell` (names), or the zone's only shell.
 * @param {string} root
 * @param {Zone} zone
 * @param {string[]} [names] `--shell` values (each may be comma-separated)
 * @returns {ShellInfo[]}
 */
export function resolveShells(root, zone, names = []) {
  const shells = listShells(root, zone);
  if (shells.length === 0) {
    throw new UsageError(
      `The ${zone} zone has no shell yet. Run "pnpm gen:shell ${zone}" first.`,
    );
  }
  const wanted = [
    ...new Set(
      names
        .flatMap((n) => n.split(','))
        .map((n) => n.trim())
        .filter(Boolean),
    ),
  ];
  if (wanted.length === 0) {
    if (shells.length === 1) return shells;
    throw new UsageError(
      `The ${zone} zone has ${shells.length} shells (${shells.map((s) => s.name).join(', ')}): say which shell(s) list the remote with --shell <name> (repeat it or comma-separate for several).`,
    );
  }
  return wanted.map((name) => {
    const shell = shells.find((s) => s.name === name);
    if (!shell) {
      throw new UsageError(
        `--shell ${name}: no such ${zone} shell (${shells.map((s) => s.name).join(', ')}).`,
      );
    }
    return shell;
  });
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
