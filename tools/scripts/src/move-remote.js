// @ts-check
/**
 * `pnpm move-remote <zone> <remote> --to shared|<shellName> [--dry-run]`: moves a remote to the
 * folder the `remote-location` check expects (layout.js) and keeps the workspace consistent:
 *
 * 1. `git mv` of the folder (history is kept);
 * 2. every tracked text file that mentions the old folder path (tsconfig references/paths, app
 *    docs, …) is rewritten to the new path (pnpm-lock.yaml excluded: step 3 rewrites it);
 * 3. `pnpm install` (workspace links), then `pnpm check`.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { SHARED_GROUP, SHELL_FOLDER, splitAppDir } from './layout.js';
import { ZONES } from './zones.js';
import { loadApps } from './workspace.js';

export class MoveError extends Error {}

/**
 * @param {{ root: string, zone: string, remote: string, to: string }} options
 * @returns {{ from: string, to: string, package: string }} directories relative to the root
 * @throws {MoveError} unknown zone / remote / shell, or the target exists
 */
export function planMove({ root, zone, remote, to }) {
  if (!Object.hasOwn(ZONES, zone)) {
    throw new MoveError(
      `Unknown zone "${zone}". Use one of: ${Object.keys(ZONES).join(', ')}.`,
    );
  }
  const apps = loadApps(root).filter((a) => splitAppDir(a.dir)?.zone === zone);
  const found = apps.find((a) => {
    const parts = splitAppDir(a.dir);
    return (
      parts?.folder === remote &&
      Array.isArray(a.pkg.nx?.tags) &&
      a.pkg.nx.tags.includes('type:remote')
    );
  });
  if (!found) {
    const known = apps
      .filter((a) => a.pkg.nx?.tags?.includes('type:remote'))
      .map((a) => splitAppDir(a.dir)?.folder);
    throw new MoveError(
      `No remote "${remote}" in the ${zone} zone (known: ${known.join(', ') || 'none'}).`,
    );
  }
  if (to !== SHARED_GROUP) {
    if (
      !fs.existsSync(
        path.join(root, 'apps', zone, to, SHELL_FOLDER, 'package.json'),
      )
    ) {
      throw new MoveError(
        `--to ${to}: no such ${zone} shell (expected apps/${zone}/${to}/${SHELL_FOLDER}). Use "shared" or a shell name.`,
      );
    }
  }
  const target = `apps/${zone}/${to}/${remote}`;
  if (target === found.dir) {
    throw new MoveError(`${remote} is already in ${found.dir}.`);
  }
  if (fs.existsSync(path.join(root, target))) {
    throw new MoveError(`${target} already exists; nothing moved.`);
  }
  return { from: found.dir, to: target, package: found.name };
}

/**
 * Tracked text files that contain `needle` (excluding the lockfile).
 * @param {string} root
 * @param {string} needle
 */
function filesMentioning(root, needle) {
  try {
    return execFileSync(
      'git',
      ['grep', '-lIF', needle, '--', '.', ':(exclude)pnpm-lock.yaml'],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    )
      .split('\n')
      .filter(Boolean);
  } catch {
    return []; // git grep exits 1 when nothing matches
  }
}

/**
 * @param {{ root: string, zone: string, remote: string, to: string, dryRun?: boolean,
 *   install?: boolean, check?: boolean, log?: (line: string) => void }} options
 *   `install` / `check` (default true) run `pnpm install` / `pnpm check`
 * @returns {{ plan: { from: string, to: string, package: string }, rewritten: string[], checkStatus?: number }}
 */
export function moveRemote({
  root,
  zone,
  remote,
  to,
  dryRun = false,
  install = true,
  check = true,
  log = console.log,
}) {
  const plan = planMove({ root, zone, remote, to });
  const rewrite = filesMentioning(root, plan.from);
  log(`${dryRun ? 'Plan' : 'Moving'}: ${plan.from} -> ${plan.to}`);
  log(`  git mv ${plan.from} ${plan.to}`);
  for (const file of rewrite) {
    // files inside the moved folder are renamed by the git mv
    const where = file.startsWith(`${plan.from}/`)
      ? `${plan.to}/${file.slice(plan.from.length + 1)}`
      : file;
    log(`  rewrite "${plan.from}" -> "${plan.to}" in ${where}`);
  }
  if (install) log('  pnpm install');
  if (check) log('  pnpm check');
  if (dryRun) return { plan, rewritten: [] };

  fs.mkdirSync(path.join(root, path.dirname(plan.to)), { recursive: true });
  execFileSync('git', ['mv', plan.from, plan.to], { cwd: root });
  /** @type {string[]} */
  const rewritten = [];
  for (const file of rewrite) {
    const rel = file.startsWith(`${plan.from}/`)
      ? `${plan.to}/${file.slice(plan.from.length + 1)}`
      : file;
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) continue;
    const text = fs.readFileSync(abs, 'utf8');
    fs.writeFileSync(abs, text.split(plan.from).join(plan.to));
    rewritten.push(rel);
  }
  // an emptied group folder (only node_modules or nothing left) is removed
  const oldGroup = path.join(root, path.dirname(plan.from));
  if (fs.existsSync(oldGroup) && fs.readdirSync(oldGroup).length === 0) {
    fs.rmdirSync(oldGroup);
  }
  if (install) {
    const r = spawnSync('pnpm', ['install'], { cwd: root, stdio: 'inherit' });
    if (r.status !== 0) {
      throw new MoveError(
        `pnpm install failed (exit ${r.status}); the folder is already moved.`,
      );
    }
  }
  let checkStatus;
  if (check) {
    checkStatus =
      spawnSync('pnpm', ['check'], { cwd: root, stdio: 'inherit' }).status ?? 1;
  }
  return { plan, rewritten, checkStatus };
}
