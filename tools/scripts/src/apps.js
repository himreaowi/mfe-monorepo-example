// @ts-check
/**
 * The workspace's apps as data (for CI matrices and `pnpm e2e`), and which apps a change
 * affects. CLI: bin/list-apps.js (`pnpm -s apps`).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ZONES, shellBasePath } from './zones.js';
import { DEP_FIELDS, loadApps, loadWorkspace } from './workspace.js';

/**
 * @typedef {{
 *   name: string,
 *   package: string,
 *   zone: string,
 *   type: 'shell' | 'remote',
 *   access: 'public' | 'private',
 *   kind: 'react' | 'external',
 *   port: number,
 *   basePath?: string,
 *   federationName: string,
 *   path: string,
 *   distDir: string,
 * }} AppInfo
 * path/distDir are relative to the workspace root (POSIX separators).
 */

/**
 * Files outside any project that change what every app ships (dependency versions, toolchain,
 * the nginx/Docker templates). A change to one of them affects every app (Markdown files excepted).
 */
export const GLOBAL_FILES = [
  'package.json',
  'pnpm-workspace.yaml',
  'pnpm-lock.yaml',
  'nx.json',
  'version-exceptions.json',
  '.nvmrc',
  'deploy/',
];

/**
 * @param {string[]} tags
 * @param {string} prefix
 */
const tagValue = (tags, prefix) =>
  tags.find((t) => t.startsWith(`${prefix}:`))?.slice(prefix.length + 1);

/**
 * Every app under apps/<zone>/<name> with its metadata, shells first within a zone.
 * @param {{ root: string, zone?: string }} options
 * @returns {AppInfo[]}
 */
export function listApps({ root, zone }) {
  const zoneOrder = Object.keys(ZONES);
  return loadApps(root)
    .map((app) => {
      const tags = /** @type {string[]} */ (app.pkg.nx?.tags ?? []);
      return /** @type {AppInfo} */ ({
        name: path.posix.basename(app.dir),
        package: app.name,
        zone: tagValue(tags, 'zone') ?? '',
        type: tagValue(tags, 'type') ?? '',
        access: tagValue(tags, 'access') ?? 'public',
        kind: tagValue(tags, 'kind') === 'external' ? 'external' : 'react',
        port: app.pkg.mfe?.port,
        // shells: where the shell is served (mfe.basePath, default "/")
        ...(tagValue(tags, 'type') === 'shell'
          ? { basePath: shellBasePath(app.pkg.mfe?.basePath) }
          : {}),
        federationName: app.pkg.mfe?.federationName,
        path: app.dir,
        distDir: `${app.dir}/dist`,
      });
    })
    .filter(
      (app) => app.zone !== '' && (zone === undefined || app.zone === zone),
    )
    .sort(
      (a, b) =>
        zoneOrder.indexOf(a.zone) - zoneOrder.indexOf(b.zone) ||
        Number(b.type === 'shell') - Number(a.type === 'shell') ||
        a.name.localeCompare(b.name),
    );
}

/**
 * Files changed between `base` and `head` (or the working tree incl. untracked files when
 * `head` is omitted), relative to the repo root.
 * @param {{ root: string, base: string, head?: string }} options
 * @returns {string[]}
 */
export function changedFiles({ root, base, head }) {
  const git = (/** @type {string[]} */ args) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8' })
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  if (head) return git(['diff', '--name-only', `${base}...${head}`]);
  return [
    ...new Set([
      ...git(['diff', '--name-only', base]),
      ...git(['ls-files', '--others', '--exclude-standard']),
    ]),
  ];
}

/**
 * Package names affected by changed files, from the workspace dependency graph: the package
 * owning a file, plus every package that (transitively) depends on it. `null` = everything
 * (a global file changed).
 * @param {{ root: string, files: string[] }} options
 * @returns {Set<string> | null}
 */
export function affectedFromFiles({ root, files }) {
  if (
    files.some(
      (f) =>
        !f.endsWith('.md') &&
        GLOBAL_FILES.some((g) => (g.endsWith('/') ? f.startsWith(g) : f === g)),
    )
  ) {
    return null;
  }
  const { packages } = loadWorkspace(root);
  const projects = packages.filter((p) => p.dir !== '.');
  const names = new Set(projects.map((p) => p.name));
  /** @type {Map<string, Set<string>>} package → packages that depend on it */
  const dependents = new Map();
  for (const p of projects) {
    for (const field of [...DEP_FIELDS, 'peerDependencies']) {
      for (const dep of Object.keys(p.pkg[field] ?? {})) {
        if (!names.has(dep)) continue;
        if (!dependents.has(dep)) dependents.set(dep, new Set());
        dependents.get(dep)?.add(p.name);
      }
    }
  }
  /** @type {Set<string>} */
  const affected = new Set();
  const queue = [];
  for (const file of files) {
    const owner = projects
      .filter((p) => file.startsWith(`${p.dir}/`))
      .sort((a, b) => b.dir.length - a.dir.length)[0];
    if (owner) queue.push(owner.name);
  }
  while (queue.length > 0) {
    const name = /** @type {string} */ (queue.pop());
    if (affected.has(name)) continue;
    affected.add(name);
    for (const dependent of dependents.get(name) ?? []) queue.push(dependent);
  }
  return affected;
}

/**
 * Affected project names according to Nx (`nx show projects --affected`), or `undefined` when
 * Nx is not available or fails.
 * @param {{ root: string, base: string, head?: string }} options
 * @returns {Set<string> | undefined}
 */
export function nxAffected({ root, base, head }) {
  const bin = path.join(root, 'node_modules', '.bin', 'nx');
  if (!fs.existsSync(bin)) return undefined;
  try {
    const out = execFileSync(
      bin,
      [
        'show',
        'projects',
        '--affected',
        `--base=${base}`,
        ...(head ? [`--head=${head}`] : []),
        '--json',
      ],
      {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, NX_DAEMON: 'false', NX_NO_CLOUD: 'true' },
      },
    );
    const parsed = JSON.parse(out.slice(out.indexOf('[')));
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Apps affected by the changes since `base`. Nx decides which projects are affected (package-based
 * graph: a change in packages/ui affects every app depending on it); without Nx the git diff is
 * mapped onto the workspace dependency graph. Changes to GLOBAL_FILES (e.g. deploy/) affect
 * every app in both modes.
 * @param {{ root: string, base: string, head?: string, zone?: string, nx?: boolean }} options
 * @returns {{ apps: AppInfo[], source: 'nx' | 'git' }}
 */
export function affectedApps({ root, base, head, zone, nx = true }) {
  const apps = listApps({ root, zone });
  const files = changedFiles({ root, base, head });
  const fromFiles = affectedFromFiles({ root, files });
  if (fromFiles === null) return { apps, source: 'git' };
  const fromNx = nx ? nxAffected({ root, base, head }) : undefined;
  const affected = fromNx ?? fromFiles;
  return {
    apps: apps.filter((app) => affected.has(app.package)),
    source: fromNx ? 'nx' : 'git',
  };
}
