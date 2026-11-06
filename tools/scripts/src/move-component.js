// @ts-check
/**
 * `pnpm move-component <app-package-or-path> <ComponentName> --to <zone>/libs/<capability> |
 * common/<capability> [--dry-run]`: moves a component out of an app into a code library
 * (docs/where-code-goes.md) and keeps the workspace consistent:
 *
 * 1. checks first, changes nothing on a refusal: the target library exists (else: pnpm
 *    gen:package), the app may use it, the component only imports its own files and packages the
 *    target may use (import table, check-packages.js), the target has no component of that name;
 * 2. `git mv` of `src/**\/components/<Name>/` to `<target>/src/components/<Name>/`;
 * 3. `export * from './components/<Name>/<Name>'` in the target's src/index.ts;
 * 4. the app depends on the target (`workspace:*`); packages the component imports are added to
 *    the target with the app's version spec;
 * 5. the app's imports of the component (`@/…/components/<Name>/<Name>`, relative paths,
 *    jest.mock paths) now name the package;
 * 6. Prettier on the changed files, `pnpm install`, `pnpm check`.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ZONES } from './zones.js';
import { loadApps, loadWorkspace } from './workspace.js';
import { COMMON_DIR, LIBS_GROUP, packageLayer } from './layout.js';
import { allowedSentence, isAllowed, sideOf } from './check-packages.js';

export class MoveComponentError extends Error {}

const COMPONENT_NAME = /^[A-Z][A-Za-z0-9]*$/;
const SOURCE_EXT = /\.(?:[cm]?[jt]sx?)$/;
const IMPORT_RE =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm;
/** Any quoted module path in app code (imports, jest.mock, require). */
const STRING_RE = /(['"])((?:\.{1,2}\/|@\/)[^'"\n]*)\1/g;

/** @param {string} p */
const toPosix = (p) => p.split(path.sep).join('/');

/**
 * Files below `dir` (recursive), without node_modules/dist.
 * @param {string} dir absolute
 */
function filesBelow(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => path.join(d.parentPath, d.name))
    .filter(
      (f) =>
        !f.includes(`${path.sep}node_modules${path.sep}`) &&
        !f.includes(`${path.sep}dist${path.sep}`),
    );
}

/**
 * `--to` → the target folder: `common/<cap>` | `packages/common/<cap>` |
 * `<zone>/libs/<cap>` | `apps/<zone>/libs/<cap>`.
 * @param {string} to
 */
export function targetDir(to) {
  const parts = to.replace(/\/+$/, '').split('/');
  if (parts[0] === 'packages') parts.shift();
  if (parts[0] === 'apps') parts.shift();
  if (parts.length === 2 && parts[0] === 'common') {
    return `${COMMON_DIR}/${parts[1]}`;
  }
  if (
    parts.length === 3 &&
    Object.hasOwn(ZONES, parts[0]) &&
    parts[1] === LIBS_GROUP
  ) {
    return `apps/${parts[0]}/${LIBS_GROUP}/${parts[2]}`;
  }
  throw new MoveComponentError(
    `--to ${to}: use common/<capability> (packages/common/<capability>) or <zone>/${LIBS_GROUP}/<capability> (apps/<zone>/${LIBS_GROUP}/<capability>, zone: ${Object.keys(ZONES).join(' | ')}).`,
  );
}

/**
 * Where an import specifier of a file points (absolute path without extension handling), or
 * `undefined` for a package import.
 * @param {string} spec
 * @param {string} file absolute
 * @param {string} srcDir absolute `src/` of the file's package (`@/` alias)
 */
function resolveSpec(spec, file, srcDir) {
  if (spec.startsWith('@/')) return path.join(srcDir, spec.slice(2));
  if (spec.startsWith('.')) return path.resolve(path.dirname(file), spec);
  return undefined;
}

/**
 * The package name of a bare import (`@scope/name/sub` → `@scope/name`).
 * @param {string} spec
 */
function packageOf(spec) {
  const parts = spec.split('/');
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

/**
 * @typedef {{
 *   app: { name: string, dir: string },
 *   target: { name: string, dir: string },
 *   from: string,
 *   to: string,
 *   component: string,
 *   addDependencies: Record<string, string>,
 *   rewrites: { file: string, from: string }[],
 * }} ComponentMovePlan
 * dirs relative to the root (POSIX). `rewrites`: app files and the specifiers that change.
 */

/**
 * Validate and plan the move; changes nothing.
 * @param {{ root: string, app: string, component: string, to: string }} options
 * @returns {ComponentMovePlan}
 */
export function planComponentMove({ root, app: appArg, component, to }) {
  if (!COMPONENT_NAME.test(component)) {
    throw new MoveComponentError(
      `"${component}" is not a component name (PascalCase, the folder name below components/).`,
    );
  }
  const apps = loadApps(root);
  const wanted = toPosix(path.relative(root, path.resolve(root, appArg)));
  const app = apps.find((a) => a.name === appArg || a.dir === wanted);
  if (!app) {
    throw new MoveComponentError(
      `No app "${appArg}" (give its package name, e.g. @org/intranet-staff, or its folder, e.g. apps/intranet/staff/staff). Apps: ${apps.map((a) => a.name).join(', ') || 'none'}.`,
    );
  }
  const appSide = sideOf(app);
  const appAbs = path.join(root, app.dir);
  const srcDir = path.join(appAbs, 'src');
  const found = [
    ...new Set(
      filesBelow(srcDir)
        .map((f) => path.dirname(f))
        .filter(
          (d) =>
            path.basename(d) === component &&
            path.basename(path.dirname(d)) === 'components',
        ),
    ),
  ].filter((d) => fs.existsSync(path.join(d, `${component}.tsx`)));
  if (found.length === 0) {
    throw new MoveComponentError(
      `${app.name} has no component ${component} (looked for src/**/components/${component}/${component}.tsx in ${app.dir}).`,
    );
  }
  if (found.length > 1) {
    throw new MoveComponentError(
      `${app.name} has ${found.length} components named ${component} (${found.map((d) => toPosix(path.relative(root, d))).join(', ')}): rename one first.`,
    );
  }
  const fromAbs = found[0];

  const tDir = targetDir(to);
  const workspace = loadWorkspace(root).packages.filter((p) => p.dir !== '.');
  const target = workspace.find((p) => p.dir === tDir);
  if (!target) {
    const layer = packageLayer(tDir);
    const genTarget = layer.layer === 'common' ? 'common' : layer.zone;
    throw new MoveComponentError(
      `${tDir} does not exist (or has no package.json). Create the library first: pnpm gen:package ${genTarget} ${layer.name} && pnpm install.`,
    );
  }
  const targetSide = /** @type {import('./check-packages.js').Side} */ (
    sideOf(target)
  );
  if (appSide && !isAllowed(appSide, targetSide)) {
    throw new MoveComponentError(
      `${app.name} may not use ${target.name} (${target.dir}). ${allowedSentence(appSide)} Pick ${appSide.zone ? `apps/${appSide.zone}/${LIBS_GROUP}/<capability> or ` : ''}${COMMON_DIR}/<capability>.`,
    );
  }
  const toAbs = path.join(root, target.dir, 'src', 'components', component);
  if (fs.existsSync(toAbs)) {
    throw new MoveComponentError(
      `${toPosix(path.relative(root, toAbs))} already exists; nothing moved.`,
    );
  }

  // the component's own imports: its folder, or packages the target may use
  /** @type {Record<string, string>} */
  const addDependencies = {};
  /** @type {string[]} */
  const problems = [];
  const named = new Map(workspace.map((p) => [p.name, p]));
  for (const file of filesBelow(fromAbs).filter((f) => SOURCE_EXT.test(f))) {
    const rel = toPosix(path.relative(root, file));
    for (const match of fs.readFileSync(file, 'utf8').matchAll(IMPORT_RE)) {
      const spec = match[1];
      const resolved = resolveSpec(spec, file, srcDir);
      if (resolved !== undefined) {
        if (resolved === fromAbs || resolved.startsWith(fromAbs + path.sep)) {
          continue;
        }
        problems.push(
          `${rel} imports "${spec}", app code outside the component folder. Move that code into ${target.name} first (or pass it in as props).`,
        );
        continue;
      }
      if (spec.startsWith('node:')) continue;
      const dep = packageOf(spec);
      if (dep === target.name) continue;
      const ws = named.get(dep);
      if (ws) {
        const depSide = sideOf(ws);
        if (depSide && !isAllowed(targetSide, depSide)) {
          problems.push(
            `${rel} imports "${spec}" (${ws.dir}), which ${target.name} may not use. ${allowedSentence(targetSide)}`,
          );
          continue;
        }
      }
      const declared = ['peerDependencies', 'dependencies', 'devDependencies']
        .map((f) => target.pkg[f]?.[dep])
        .find(Boolean);
      if (declared) continue;
      const spec2 = ['dependencies', 'devDependencies', 'peerDependencies']
        .map((f) => app.pkg[f]?.[dep])
        .find(Boolean);
      if (spec2) addDependencies[dep] = ws ? 'workspace:*' : spec2;
    }
  }
  if (problems.length > 0) {
    throw new MoveComponentError(
      `Moving ${component} into ${target.name} would break the import rules (docs/where-code-goes.md); nothing moved:\n  - ${problems.join('\n  - ')}`,
    );
  }

  // the app's references to the component
  /** @type {{ file: string, from: string }[]} */
  const rewrites = [];
  const main = path.join(fromAbs, component);
  for (const file of filesBelow(srcDir).filter((f) => SOURCE_EXT.test(f))) {
    if (file.startsWith(fromAbs + path.sep)) continue;
    const code = fs.readFileSync(file, 'utf8');
    for (const match of code.matchAll(STRING_RE)) {
      const spec = match[2];
      const resolved = resolveSpec(spec, file, srcDir);
      if (
        resolved &&
        [main, fromAbs].includes(resolved.replace(/\.[jt]sx?$/, ''))
      ) {
        rewrites.push({ file: toPosix(path.relative(root, file)), from: spec });
      }
    }
  }

  return {
    app: { name: app.name, dir: app.dir },
    target: { name: target.name, dir: target.dir },
    from: toPosix(path.relative(root, fromAbs)),
    to: toPosix(path.relative(root, toAbs)),
    component,
    addDependencies,
    rewrites,
  };
}

/**
 * @param {string} file
 * @param {(pkg: Record<string, any>) => void} change
 */
function editJson(file, change) {
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
  change(pkg);
  fs.writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
}

/** @param {Record<string, string>} obj */
const sorted = (obj) =>
  Object.fromEntries(
    Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)),
  );

/**
 * @param {{ root: string, app: string, component: string, to: string, dryRun?: boolean,
 *   install?: boolean, check?: boolean, format?: boolean, log?: (line: string) => void }} options
 *   `install` / `check` / `format` (default true) run `pnpm install` / `pnpm check` / Prettier
 * @returns {{ plan: ComponentMovePlan, checkStatus?: number }}
 */
export function moveComponent({
  root,
  app,
  component,
  to,
  dryRun = false,
  install = true,
  check = true,
  format = true,
  log = console.log,
}) {
  const plan = planComponentMove({ root, app, component, to });
  const index = `${plan.target.dir}/src/index.ts`;
  log(
    `${dryRun ? 'Plan' : 'Moving'}: ${plan.component} from ${plan.app.name} to ${plan.target.name}`,
  );
  log(`  git mv ${plan.from} ${plan.to}`);
  log(
    `  export * from './components/${plan.component}/${plan.component}' in ${index}`,
  );
  log(
    `  ${plan.app.dir}/package.json: dependency ${plan.target.name}: workspace:*`,
  );
  for (const [dep, spec] of Object.entries(plan.addDependencies)) {
    log(`  ${plan.target.dir}/package.json: dependency ${dep}: ${spec}`);
  }
  for (const r of plan.rewrites) {
    log(`  rewrite "${r.from}" -> "${plan.target.name}" in ${r.file}`);
  }
  if (install) log('  pnpm install');
  if (check) log('  pnpm check');
  if (dryRun) return { plan };

  const toAbs = path.join(root, plan.to);
  fs.mkdirSync(path.dirname(toAbs), { recursive: true });
  execFileSync('git', ['mv', plan.from, plan.to], { cwd: root });
  // untracked leftovers (e.g. snapshots not yet committed) follow the folder
  const fromAbs = path.join(root, plan.from);
  if (fs.existsSync(fromAbs)) {
    for (const entry of fs.readdirSync(fromAbs)) {
      const dest = path.join(toAbs, entry);
      if (!fs.existsSync(dest)) fs.renameSync(path.join(fromAbs, entry), dest);
    }
    fs.rmSync(fromAbs, { recursive: true, force: true });
  }
  const parent = path.dirname(fromAbs);
  if (fs.existsSync(parent) && fs.readdirSync(parent).length === 0) {
    fs.rmdirSync(parent);
  }

  const indexAbs = path.join(root, index);
  const exportLine = `export * from './components/${plan.component}/${plan.component}';\n`;
  const current = fs.existsSync(indexAbs)
    ? fs.readFileSync(indexAbs, 'utf8')
    : '';
  fs.writeFileSync(
    indexAbs,
    `${current}${current === '' || current.endsWith('\n') ? '' : '\n'}${exportLine}`,
  );

  editJson(path.join(root, plan.app.dir, 'package.json'), (pkg) => {
    pkg.dependencies = sorted({
      ...(pkg.dependencies ?? {}),
      [plan.target.name]: 'workspace:*',
    });
  });
  if (Object.keys(plan.addDependencies).length > 0) {
    editJson(path.join(root, plan.target.dir, 'package.json'), (pkg) => {
      pkg.dependencies = sorted({
        ...(pkg.dependencies ?? {}),
        ...plan.addDependencies,
      });
    });
  }
  const changed = new Set([
    index,
    `${plan.app.dir}/package.json`,
    `${plan.target.dir}/package.json`,
  ]);
  for (const r of plan.rewrites) {
    const abs = path.join(root, r.file);
    const code = fs.readFileSync(abs, 'utf8');
    fs.writeFileSync(
      abs,
      code
        .split(`'${r.from}'`)
        .join(`'${plan.target.name}'`)
        .split(`"${r.from}"`)
        .join(`"${plan.target.name}"`),
    );
    changed.add(r.file);
  }

  if (format) {
    spawnSync('pnpm', ['exec', 'prettier', '--write', ...changed], {
      cwd: root,
      stdio: 'ignore',
    });
  }
  if (install) {
    const r = spawnSync('pnpm', ['install'], { cwd: root, stdio: 'inherit' });
    if (r.status !== 0) {
      throw new MoveComponentError(
        `pnpm install failed (exit ${r.status}); the component is already moved.`,
      );
    }
  }
  let checkStatus;
  if (check) {
    checkStatus =
      spawnSync('pnpm', ['check'], { cwd: root, stdio: 'inherit' }).status ?? 1;
  }
  return { plan, checkStatus };
}
