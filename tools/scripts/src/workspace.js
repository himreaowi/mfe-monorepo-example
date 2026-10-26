// @ts-check
/** Reads the pnpm workspace: catalogs and every workspace package. */
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { LIBS_GROUP } from './layout.js';

/** Dependency fields checked (peerDependencies express compatibility ranges, not installs). */
export const DEP_FIELDS = /** @type {const} */ ([
  'dependencies',
  'devDependencies',
  'optionalDependencies',
]);

/**
 * @typedef {{
 *   name: string,
 *   dir: string,
 *   file: string,
 *   pkg: Record<string, any>,
 * }} WorkspacePackage
 * dir/file are relative to the workspace root ('.' for the root package).
 */

/**
 * @param {string} file
 * @returns {any}
 */
export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** @param {string} p */
const toPosix = (p) => p.split(path.sep).join('/');

/**
 * @param {string} root
 */
export function loadWorkspace(root) {
  const wsFile = path.join(root, 'pnpm-workspace.yaml');
  const ws = fs.existsSync(wsFile)
    ? (YAML.parse(fs.readFileSync(wsFile, 'utf8')) ?? {})
    : {};
  /** @type {Record<string, Record<string, string>>} */
  const catalogs = { ...(ws.catalogs ?? {}) };
  catalogs.default = { ...(catalogs.default ?? {}), ...(ws.catalog ?? {}) };

  /** @type {string[]} */
  const patterns = ws.packages ?? [];
  const include = patterns.filter((p) => !p.startsWith('!'));
  const exclude = patterns
    .filter((p) => p.startsWith('!'))
    .map((p) => p.slice(1));

  /** @type {Set<string>} */
  const files = new Set();
  for (const pattern of include) {
    for (const match of fs.globSync(`${pattern}/package.json`, {
      cwd: root,
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        ...exclude.map((e) => `${e}/package.json`),
      ],
    })) {
      files.add(toPosix(match));
    }
  }
  /** @type {WorkspacePackage[]} */
  const packages = [];
  if (fs.existsSync(path.join(root, 'package.json'))) {
    const pkg = readJson(path.join(root, 'package.json'));
    packages.push({
      name: pkg.name ?? '(root)',
      dir: '.',
      file: 'package.json',
      pkg,
    });
  }
  for (const file of [...files].sort()) {
    const pkg = readJson(path.join(root, file));
    packages.push({
      name: pkg.name ?? toPosix(path.dirname(file)),
      dir: toPosix(path.dirname(file)),
      file,
      pkg,
    });
  }
  return { root, catalogs, packages };
}

/**
 * Package.json files of every app, apps/<zone>/<group>/<folder> (also the old flat
 * apps/<zone>/<name> and deeper paths, so misplaced apps are found and reported by the check).
 * The zone libraries in apps/<zone>/libs/ are code packages, not apps: they are skipped here
 * (check-packages.js checks them).
 * @param {string} root
 * @returns {WorkspacePackage[]}
 */
export function loadApps(root) {
  if (!fs.existsSync(path.join(root, 'apps'))) return [];
  return fs
    .globSync('apps/**/package.json', {
      cwd: root,
      exclude: ['**/node_modules/**', '**/dist/**', `apps/*/${LIBS_GROUP}/**`],
    })
    .map(toPosix)
    .sort()
    .map((file) => {
      const pkg = readJson(path.join(root, file));
      return {
        name: pkg.name ?? path.dirname(file),
        dir: toPosix(path.dirname(file)),
        file,
        pkg,
      };
    });
}
