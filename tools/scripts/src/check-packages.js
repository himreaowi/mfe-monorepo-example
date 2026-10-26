// @ts-check
/**
 * check-packages: where code lives and what may use what (docs/where-code-goes.md). The rules
 * come from the folders alone (layout.js `packageLayer`):
 *
 *   remote / shell in zone Z      → apps/Z/libs/*, packages/common/*, packages/platform/*
 *   apps/Z/libs/<capability>      → apps/Z/libs/*, packages/common/*, packages/platform/*
 *   packages/common/<capability>  → packages/common/*, packages/platform/*
 *   packages/platform/<name>      → packages/platform/*
 *
 * Never the other zone; libraries and packages never use apps (app → app is check-apps).
 *
 * - package-boundaries: package.json dependencies and source imports (by package name or by a
 *   relative path into another package) follow the table. The Nx lint rule
 *   (@org/eslint-config `depConstraints`, tags from `layerTags`) enforces the same table on
 *   imports; a test keeps both in sync
 * - package-location: packages/ holds only platform/<name> and common/<capability>;
 *   apps/<zone>/libs/ holds only library folders with a package.json
 * - library-name: @org/common-<capability> / @org/<zone>-<capability>, matching the folder
 * - library-tags: Nx tags derived from the folder (`layerTags`)
 * - library-shape: a library is never deployed alone: no `mfe` block (port, federation name),
 *   no webpack config; its front door is src/index.ts
 * - library-component-files: src/components/<Name>/ holds <Name>.tsx and <Name>.test.tsx
 *   (<Name>.module.scss when it has styles; stories optional)
 * - package-name: every workspace package has its own name
 */
import fs from 'node:fs';
import path from 'node:path';
import { ZONES } from './zones.js';
import { loadWorkspace } from './workspace.js';
import {
  COMMON_DIR,
  LIBS_GROUP,
  PLATFORM_DIR,
  libraryPackageName,
  packageLayer,
} from './layout.js';

/** @typedef {import('./check-versions.js').Issue} Issue */
/** @typedef {import('./workspace.js').WorkspacePackage} WorkspacePackage */
/**
 * A package's place in the import table.
 * @typedef {{ layer: 'app' | 'lib' | 'common' | 'platform' | 'tool', zone?: string }} Side
 */

const CHECK = 'check-packages';
export const WHERE_CODE_GOES = 'docs/where-code-goes.md';
const DEP_FIELDS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
];
const SOURCE_EXT = /\.(?:[cm]?[jt]sx?)$/;
const IMPORT_RE =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm;
const COMPONENT_NAME = /^[A-Z][A-Za-z0-9]*$/;

/**
 * The side of a workspace package in the import table, from its folder. `undefined` for the
 * root package and misplaced folders.
 * @param {{ dir: string }} pkg
 * @returns {Side | undefined}
 */
export function sideOf(pkg) {
  const { layer, zone } = packageLayer(pkg.dir);
  if (layer === 'app' || layer === 'lib') return { layer, zone };
  if (layer === 'common' || layer === 'platform' || layer === 'tool') {
    return { layer };
  }
  return undefined;
}

/**
 * May `source` depend on / import `target`? App → app is not decided here (check-apps reports
 * it with its own rules), it returns false. Tools may use anything (dev tooling).
 * @param {Side} source
 * @param {Side} target
 */
export function isAllowed(source, target) {
  if (source.layer === 'tool') return true;
  if (target.layer === 'platform') return true;
  const sameZoneLib = target.layer === 'lib' && target.zone === source.zone;
  switch (source.layer) {
    case 'app':
      return (
        target.layer === 'common' || target.layer === 'tool' || sameZoneLib
      );
    case 'lib':
      return target.layer === 'common' || sameZoneLib;
    case 'common':
      return target.layer === 'common';
    default:
      return false; // platform → non-platform
  }
}

/**
 * Nx tags of a code package, derived from its folder (the generators write them, the
 * `library-tags` rule checks them, @org/eslint-config `depConstraints` reads them).
 * @param {Side} side
 * @returns {string[] | undefined} undefined for apps (zone/type/access, check-apps) and tools
 */
export function layerTags(side) {
  if (side.layer === 'lib') return [`zone:${side.zone}`, 'type:lib'];
  if (side.layer === 'common') return ['type:common'];
  if (side.layer === 'platform') return ['type:package'];
  return undefined;
}

/** "A" / "An" before a word. @param {string | undefined} word */
const article = (word) => (/^[aeiou]/i.test(word ?? '') ? 'An' : 'A');

/**
 * What a side may use (one sentence for the messages).
 * @param {Side} s
 */
export function allowedSentence(s) {
  switch (s.layer) {
    case 'app':
      return `${article(s.zone)} ${s.zone} remote or shell may use apps/${s.zone}/${LIBS_GROUP}/*, ${COMMON_DIR}/* and ${PLATFORM_DIR}/* (never the other zone, never another app).`;
    case 'lib':
      return `${article(s.zone)} ${s.zone} library (apps/${s.zone}/${LIBS_GROUP}/*) may use apps/${s.zone}/${LIBS_GROUP}/*, ${COMMON_DIR}/* and ${PLATFORM_DIR}/* only: never a remote or shell, never the other zone.`;
    case 'common':
      return `${COMMON_DIR}/* may use only ${COMMON_DIR}/* and ${PLATFORM_DIR}/*: it is used by both zones and ships to the public internet portals, so it never uses zone code.`;
    case 'platform':
      return `${PLATFORM_DIR}/* is plumbing and uses only other ${PLATFORM_DIR}/* packages.`;
    default:
      return '';
  }
}

/**
 * How to fix a denied pair.
 * @param {Side} source
 * @param {Side} target
 */
function fixFor(source, target) {
  if (
    (source.layer === 'app' || source.layer === 'lib') &&
    target.zone !== undefined &&
    target.zone !== source.zone
  ) {
    return `Fix: code both zones need goes to ${COMMON_DIR}/<capability> (pnpm gen:package common <capability>) when it may be public; otherwise keep a separate copy in apps/${source.zone}/${LIBS_GROUP}/.`;
  }
  if (source.layer === 'common') {
    return `Fix: keep zone-specific code in apps/<zone>/${LIBS_GROUP}/ and pass what the common code needs as arguments. Confidential or intranet-only rules never go to ${COMMON_DIR}.`;
  }
  if (source.layer === 'lib' && target.layer === 'app') {
    return `Fix: move the code the library needs out of the app into the library (pnpm move-component <app> <Component> --to ${source.zone}/${LIBS_GROUP}/<capability>), or pass it in as props or arguments.`;
  }
  if (source.layer === 'platform') {
    return `Fix: platform packages know no business code. Move this code out of ${PLATFORM_DIR}, or let the app pass it in.`;
  }
  return 'Fix: remove the dependency.';
}

/**
 * @param {Side} s
 * @param {WorkspacePackage} pkg
 */
function describe(s, pkg) {
  const tags = /** @type {string[]} */ (pkg.pkg.nx?.tags ?? []);
  switch (s.layer) {
    case 'app': {
      const type = tags.includes('type:shell') ? 'shell' : 'remote';
      return `the ${s.zone} ${type} ${pkg.name} (${pkg.dir})`;
    }
    case 'lib':
      return `the ${s.zone} zone library ${pkg.name} (${pkg.dir})`;
    case 'common':
      return `the common package ${pkg.name} (${pkg.dir})`;
    case 'platform':
      return `the platform package ${pkg.name} (${pkg.dir})`;
    default:
      return `the tool ${pkg.name} (${pkg.dir})`;
  }
}

/**
 * Source files below `dir/src` (no node_modules/dist).
 * @param {string} dir absolute
 */
function sourceFiles(dir) {
  const src = path.join(dir, 'src');
  if (!fs.existsSync(src)) return [];
  return fs
    .readdirSync(src, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile() && SOURCE_EXT.test(d.name))
    .map((d) => path.join(d.parentPath, d.name))
    .filter(
      (f) =>
        !f.includes(`${path.sep}node_modules${path.sep}`) &&
        !f.includes(`${path.sep}dist${path.sep}`),
    );
}

/**
 * @param {string} dir
 * @returns {fs.Dirent[]}
 */
function entries(dir) {
  return fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : [];
}

/** @param {string} p */
const toPosix = (p) => p.split(path.sep).join('/');

/**
 * The workspace packages plus package.json files in places pnpm does not pick up but that look
 * like misplaced code packages (packages/<x>/, packages/<other>/<y>/, packages/<x>/<y>/<z>/,
 * apps/<zone>/libs/…).
 * @param {string} root
 * @param {WorkspacePackage[]} packages
 */
function strayPackageDirs(root, packages) {
  const known = new Set(packages.map((p) => p.dir));
  return fs
    .globSync(
      [
        'packages/package.json',
        'packages/*/package.json',
        'packages/*/*/package.json',
        'packages/*/*/*/package.json',
        `apps/*/${LIBS_GROUP}/package.json`,
        `apps/*/${LIBS_GROUP}/*/*/package.json`,
      ],
      { cwd: root, exclude: ['**/node_modules/**', '**/dist/**'] },
    )
    .map((f) => toPosix(path.dirname(f)))
    .filter((d) => !known.has(d))
    .sort();
}

/**
 * @param {{ root: string }} options
 * @returns {Promise<{ errors: Issue[], warnings: Issue[] }>}
 */
export async function checkPackages({ root }) {
  /** @type {Issue[]} */
  const errors = [];
  const err = (/** @type {string} */ rule, /** @type {string} */ message) =>
    errors.push({ check: CHECK, rule, message });

  const packages = loadWorkspace(root).packages.filter((p) => p.dir !== '.');

  // --- location -------------------------------------------------------------------------------
  const locationHint = `Code packages live in ${PLATFORM_DIR}/<name> (plumbing), ${COMMON_DIR}/<capability> (business logic for both zones) or apps/<zone>/${LIBS_GROUP}/<capability> (shared by one zone's apps); pnpm gen:package <common|${Object.keys(ZONES).join('|')}> <capability> creates one. See ${WHERE_CODE_GOES}.`;
  for (const dir of strayPackageDirs(root, packages)) {
    err(
      'package-location',
      `${dir}/package.json: misplaced package. ${locationHint}`,
    );
  }
  for (const pkg of packages) {
    const where = packageLayer(pkg.dir);
    const codePackage = ['platform', 'common', 'lib'].includes(where.layer);
    if (where.layer === 'other' || (codePackage && !where.depthOk)) {
      err(
        'package-location',
        `${pkg.name} (${pkg.dir}): misplaced package. ${locationHint}`,
      );
    } else if (
      where.layer === 'lib' &&
      !Object.hasOwn(ZONES, where.zone ?? '')
    ) {
      err(
        'package-location',
        `${pkg.name} (${pkg.dir}): unknown zone folder "${where.zone}". Zone libraries live in ${Object.keys(
          ZONES,
        )
          .map((z) => `apps/${z}/${LIBS_GROUP}/`)
          .join(' or ')}.`,
      );
    }
  }
  for (const zone of Object.keys(ZONES)) {
    const libsDir = path.join(root, 'apps', zone, LIBS_GROUP);
    for (const item of entries(libsDir)) {
      if (item.name === 'node_modules' || item.name === 'README.md') continue;
      const rel = `apps/${zone}/${LIBS_GROUP}/${item.name}`;
      if (!item.isDirectory()) {
        err(
          'package-location',
          `${rel}: unknown item. apps/${zone}/${LIBS_GROUP}/ holds one folder per library (apps/${zone}/${LIBS_GROUP}/<capability>/ with a package.json) and an optional README.md.`,
        );
      } else if (
        !fs.existsSync(path.join(libsDir, item.name, 'package.json'))
      ) {
        err(
          'package-location',
          `${rel}/: a library folder needs a package.json. Create libraries with pnpm gen:package ${zone} ${item.name}.`,
        );
      }
    }
  }

  // --- unique names ---------------------------------------------------------------------------
  /** @type {Map<string, WorkspacePackage[]>} */
  const byName = new Map();
  for (const pkg of packages) {
    byName.set(pkg.name, [...(byName.get(pkg.name) ?? []), pkg]);
  }
  for (const [name, list] of byName) {
    if (list.length > 1) {
      err(
        'package-name',
        `${name} is the name of ${list.length} packages (${list.map((p) => p.dir).join(', ')}). Every package needs its own name; a zone library and a remote of the same zone cannot share a name (@org/<zone>-<name>): rename one.`,
      );
    }
  }

  // --- library shape --------------------------------------------------------------------------
  for (const pkg of packages) {
    const where = packageLayer(pkg.dir);
    const side = sideOf(pkg);
    if (!side || !where.depthOk) continue;
    if (side.layer === 'lib' && !Object.hasOwn(ZONES, side.zone ?? ''))
      continue;
    const expectedTags = layerTags(side);
    if (expectedTags) {
      const tags = Array.isArray(pkg.pkg.nx?.tags) ? pkg.pkg.nx.tags : [];
      const same =
        tags.length === expectedTags.length &&
        expectedTags.every((t) => tags.includes(t));
      if (!same) {
        err(
          'library-tags',
          `${pkg.name} (${pkg.file}): the Nx tags follow the folder: set "nx": { "tags": ${JSON.stringify(expectedTags)} } (found ${JSON.stringify(tags)}). The lint rule @nx/enforce-module-boundaries uses them to enforce the import table (${WHERE_CODE_GOES}).`,
        );
      }
    }
    if (side.layer !== 'lib' && side.layer !== 'common') continue;
    const target = side.layer === 'common' ? 'common' : String(side.zone);
    const expectedName = libraryPackageName(target, String(where.name));
    const label =
      side.layer === 'common'
        ? 'A common package'
        : `A ${side.zone} zone library`;
    if (pkg.name !== expectedName) {
      err(
        'library-name',
        `${pkg.dir}: ${label.toLowerCase()} is named after its folder: "name": "${expectedName}" (found "${pkg.name}"). Rename the package (and its imports), or the folder.`,
      );
    }
    const dir = path.join(root, pkg.dir);
    if (pkg.pkg.mfe !== undefined) {
      err(
        'library-shape',
        `${pkg.file}: ${label} is code, never deployed alone: remove the "mfe" block (no port, no federation name). The apps that import it bundle it.`,
      );
    }
    const webpack = entries(dir).find((d) => /^webpack\.config\./.test(d.name));
    if (webpack) {
      err(
        'library-shape',
        `${pkg.dir}/${webpack.name}: ${label} has no build of its own (the apps bundle its sources): remove the webpack config.`,
      );
    }
    if (!fs.existsSync(path.join(dir, 'src', 'index.ts'))) {
      err(
        'library-shape',
        `${pkg.dir}: missing src/index.ts. It is the front door of the package: export what the apps may use from it (and set "exports": { ".": "./src/index.ts" } in package.json).`,
      );
    }
    const componentsDir = path.join(dir, 'src', 'components');
    for (const item of entries(componentsDir)) {
      const rel = `${pkg.dir}/src/components/${item.name}`;
      if (!item.isDirectory()) {
        err(
          'library-component-files',
          `${rel}: one folder per component (src/components/<Name>/<Name>.tsx with <Name>.test.tsx). See docs/coding-conventions.md ("One folder per component").`,
        );
        continue;
      }
      const name = item.name;
      const missing = [`${name}.tsx`, `${name}.test.tsx`].filter(
        (f) => !fs.existsSync(path.join(componentsDir, name, f)),
      );
      if (!COMPONENT_NAME.test(name) || missing.length > 0) {
        err(
          'library-component-files',
          `${rel}/: a component folder is named after its component (PascalCase) and has ${name}.tsx and ${name}.test.tsx (${name}.module.scss for its styles, stories optional)${missing.length > 0 ? ` (missing: ${missing.join(', ')})` : ''}.`,
        );
      }
    }
  }

  // --- boundaries: package.json ---------------------------------------------------------------
  /** @type {Map<string, WorkspacePackage>} */
  const named = new Map(packages.map((p) => [p.name, p]));
  /**
   * @param {WorkspacePackage} from
   * @param {WorkspacePackage} to
   */
  const denied = (from, to) => {
    const source = sideOf(from);
    const target = sideOf(to);
    if (!source || !target || from === to) return undefined;
    if (source.layer === 'app' && target.layer === 'app') return undefined; // check-apps
    return isAllowed(source, target) ? undefined : { source, target };
  };
  for (const pkg of packages) {
    for (const field of DEP_FIELDS) {
      for (const dep of Object.keys(pkg.pkg[field] ?? {})) {
        const target = named.get(dep);
        if (!target) continue;
        const pair = denied(pkg, target);
        if (!pair) continue;
        err(
          'package-boundaries',
          `${pkg.name} (${pkg.file} ${field}) depends on ${describe(pair.target, target)}. ${allowedSentence(pair.source)} ${fixFor(pair.source, pair.target)} Then remove "${dep}" from ${field}. See ${WHERE_CODE_GOES}.`,
        );
      }
    }
  }

  // --- boundaries: source imports -------------------------------------------------------------
  const byDir = [...packages].sort((a, b) => b.dir.length - a.dir.length);
  for (const pkg of packages) {
    const source = sideOf(pkg);
    if (!source || source.layer === 'tool') continue;
    const abs = path.join(root, pkg.dir);
    for (const file of sourceFiles(abs)) {
      const rel = toPosix(path.relative(root, file));
      const seen = new Set();
      for (const match of fs.readFileSync(file, 'utf8').matchAll(IMPORT_RE)) {
        const spec = match[1];
        if (seen.has(spec)) continue;
        seen.add(spec);
        /** @type {WorkspacePackage | undefined} */
        let target;
        if (spec.startsWith('.')) {
          const resolved = path.resolve(path.dirname(file), spec);
          if (resolved === abs || resolved.startsWith(abs + path.sep)) continue;
          const relResolved = toPosix(path.relative(root, resolved));
          target = byDir.find(
            (p) => relResolved === p.dir || relResolved.startsWith(`${p.dir}/`),
          );
        } else {
          target = packages.find(
            (p) => spec === p.name || spec.startsWith(`${p.name}/`),
          );
        }
        if (!target) continue;
        const pair = denied(pkg, target);
        if (!pair) continue;
        err(
          'package-boundaries',
          `${rel} imports "${spec}" from ${describe(pair.target, target)}. ${allowedSentence(pair.source)} ${fixFor(pair.source, pair.target)} See ${WHERE_CODE_GOES}.`,
        );
      }
    }
  }

  return { errors, warnings: [] };
}
