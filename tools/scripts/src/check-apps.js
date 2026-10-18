// @ts-check
/**
 * check-apps: backstop for the Nx module-boundary lint rule.
 *
 * - every app lives at apps/<zone>/<name> and declares its Nx tags (zone, type, access) and a
 *   dev port (`mfe.port`) inside its zone's range; ports and federation names are unique
 * - at most one shell per zone, named shell-<zone>
 * - no app's package.json depends on another app (cross-zone deps reported as such)
 * - no app's source imports another app (by package name or by a relative path)
 * - each shell's remotes.json / mfe-manifest.dev.json match the remotes of its zone
 */
import fs from 'node:fs';
import path from 'node:path';
import { APP_TAGS, FEDERATION_NAME, ZONES } from './zones.js';
import { loadApps, readJson } from './workspace.js';

/** @typedef {import('./check-versions.js').Issue} Issue */
/** @typedef {import('./workspace.js').WorkspacePackage} WorkspacePackage */

const CHECK = 'check-apps';
const ALL_DEP_FIELDS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
];
const SOURCE_EXT = /\.(?:[cm]?[jt]sx?)$/;
const IMPORT_RE =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm;

/**
 * @typedef {{
 *   app: WorkspacePackage,
 *   zone: string | undefined,
 *   dirName: string | undefined,
 *   tags: string[],
 *   type: string | undefined,
 *   access: string | undefined,
 *   port: unknown,
 *   federationName: unknown,
 * }} AppInfo
 */

/**
 * @param {string[]} tags
 * @param {string} prefix
 */
function tagValues(tags, prefix) {
  return tags
    .filter((t) => t.startsWith(`${prefix}:`))
    .map((t) => t.slice(prefix.length + 1));
}

/**
 * Source files of an app (src/ only, no node_modules/dist).
 * @param {string} dir
 * @returns {string[]}
 */
function sourceFiles(dir) {
  const src = path.join(dir, 'src');
  if (!fs.existsSync(src)) return [];
  return fs
    .readdirSync(src, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile() && SOURCE_EXT.test(d.name))
    .map((d) => path.join(d.parentPath, d.name))
    .filter((f) => !f.includes(`${path.sep}node_modules${path.sep}`));
}

/**
 * @param {{ root: string }} options
 * @returns {Promise<{ errors: Issue[], warnings: Issue[] }>}
 */
export async function checkApps({ root }) {
  /** @type {Issue[]} */
  const errors = [];
  /** @type {Issue[]} */
  const warnings = [];
  const err = (/** @type {string} */ rule, /** @type {string} */ message) =>
    errors.push({ check: CHECK, rule, message });
  const warn = (/** @type {string} */ rule, /** @type {string} */ message) =>
    warnings.push({ check: CHECK, rule, message });

  const apps = loadApps(root);
  /** @type {AppInfo[]} */
  const infos = [];

  // --- placement, tags, port ------------------------------------------------------------------
  for (const app of apps) {
    const parts = app.dir.split('/'); // apps/<zone>/<name>
    const where = `${app.name} (${app.file})`;
    if (parts.length !== 3) {
      err(
        'app-location',
        `${where}: apps must live at apps/<zone>/<name> (zone: ${Object.keys(ZONES).join(' | ')}). Move it, or generate apps with pnpm gen:shell / pnpm gen:remote.`,
      );
      continue;
    }
    const [, zone, dirName] = parts;
    if (!Object.hasOwn(ZONES, zone)) {
      err(
        'app-location',
        `${where}: unknown zone folder "${zone}". Use apps/intranet/... or apps/internet/....`,
      );
      continue;
    }
    const tags = Array.isArray(app.pkg.nx?.tags) ? app.pkg.nx.tags : [];
    const tagHint = `Set "nx": { "tags": ["zone:${zone}", "type:<shell|remote>", "access:<public|private>"] } in ${app.file}.`;
    if (!Array.isArray(app.pkg.nx?.tags)) {
      err('app-tags', `${where}: missing nx.tags. ${tagHint}`);
    }
    const zones = tagValues(tags, 'zone');
    const types = tagValues(tags, 'type');
    const accesses = tagValues(tags, 'access');
    const kinds = tagValues(tags, 'kind');
    if (zones.length !== 1 || zones[0] !== zone) {
      err(
        'app-tags',
        `${where}: needs exactly one zone tag "zone:${zone}" (matching its folder), found [${zones.map((z) => `zone:${z}`).join(', ')}]. ${tagHint}`,
      );
    }
    if (
      types.length !== 1 ||
      !APP_TAGS.type.includes(/** @type {any} */ (types[0]))
    ) {
      err(
        'app-tags',
        `${where}: needs exactly one of "type:shell" / "type:remote", found [${types.map((t) => `type:${t}`).join(', ')}].`,
      );
    }
    if (
      accesses.length !== 1 ||
      !APP_TAGS.access.includes(/** @type {any} */ (accesses[0]))
    ) {
      err(
        'app-tags',
        `${where}: needs exactly one of "access:public" / "access:private", found [${accesses.map((t) => `access:${t}`).join(', ')}].`,
      );
    }
    for (const kind of kinds) {
      if (!APP_TAGS.kind.includes(/** @type {any} */ (kind))) {
        err(
          'app-tags',
          `${where}: unknown tag "kind:${kind}" (allowed: kind:external).`,
        );
      }
    }
    const type = types[0];
    if (type === 'shell' && dirName !== `shell-${zone}`) {
      err(
        'app-shell',
        `${where}: a shell must be apps/${zone}/shell-${zone} (found apps/${zone}/${dirName}).`,
      );
    }
    if (type === 'remote' && dirName.startsWith('shell-')) {
      err('app-shell', `${where}: "shell-*" folders are reserved for shells.`);
    }

    const port = app.pkg.mfe?.port;
    const range = ZONES[/** @type {keyof typeof ZONES} */ (zone)];
    if (!Number.isInteger(port)) {
      err(
        'app-port',
        `${where}: missing "mfe": { "port": <number> } (${zone} range ${range.first}-${range.last}).`,
      );
    } else if (port >= range.tools.first && port <= range.tools.last) {
      err(
        'app-port',
        `${where}: port ${port} is reserved for the ${zone} dev tools (${range.tools.first}-${range.tools.last}: mock API, mock vendor). Apps use ${range.first}-${range.last}.`,
      );
    } else if (port < range.first || port > range.last) {
      err(
        'app-port',
        `${where}: port ${port} is outside the ${zone} range ${range.first}-${range.last}. Pick a free port in the range.`,
      );
    }
    const federationName = app.pkg.mfe?.federationName;
    if (
      typeof federationName !== 'string' ||
      !FEDERATION_NAME.test(federationName)
    ) {
      err(
        'app-federation-name',
        `${where}: "mfe.federationName" must be a JS identifier (e.g. ${zone}_${dirName.replaceAll('-', '_')}).`,
      );
    }
    infos.push({
      app,
      zone,
      dirName,
      tags,
      type,
      access: accesses[0],
      port,
      federationName,
    });
  }

  // --- uniqueness -------------------------------------------------------------------------------
  /**
   * @param {(i: AppInfo) => unknown} key
   * @param {string} rule
   * @param {(value: unknown, list: AppInfo[]) => string} message
   */
  const unique = (key, rule, message) => {
    /** @type {Map<unknown, AppInfo[]>} */
    const by = new Map();
    for (const info of infos) {
      const k = key(info);
      if (k === undefined || k === null) continue;
      by.set(k, [...(by.get(k) ?? []), info]);
    }
    for (const [value, list] of by) {
      if (list.length > 1) err(rule, message(value, list));
    }
  };
  const names = (/** @type {AppInfo[]} */ list) =>
    list.map((i) => `${i.app.name} (${i.app.dir})`).join(', ');
  unique(
    (i) => (Number.isInteger(i.port) ? i.port : undefined),
    'app-port-duplicate',
    (port, list) =>
      `Dev port ${port} is used by ${list.length} apps: ${names(list)}. Each app needs its own port; change "mfe.port" of all but one (and the shell's mfe-manifest.dev.json entry).`,
  );
  unique(
    (i) =>
      typeof i.federationName === 'string' ? i.federationName : undefined,
    'app-federation-name-duplicate',
    (name, list) =>
      `Federation name ${name} is used by ${list.length} apps: ${names(list)}. Federation names must be unique.`,
  );
  unique(
    (i) => i.app.name,
    'app-name-duplicate',
    (name, list) =>
      `Package name ${name} is used by ${list.length} apps: ${names(list)}.`,
  );
  for (const zone of Object.keys(ZONES)) {
    const shells = infos.filter((i) => i.zone === zone && i.type === 'shell');
    if (shells.length > 1) {
      err(
        'app-shell',
        `Zone ${zone} has ${shells.length} shells: ${names(shells)}. One shell per zone.`,
      );
    }
  }

  // --- app → app dependencies (package.json) ----------------------------------------------------
  /** @type {Map<string, AppInfo>} */
  const byName = new Map(infos.map((i) => [i.app.name, i]));
  for (const info of infos) {
    for (const field of ALL_DEP_FIELDS) {
      for (const dep of Object.keys(info.app.pkg[field] ?? {})) {
        const target = byName.get(dep);
        if (!target || target === info) continue;
        const crossZone = target.zone !== info.zone;
        err(
          crossZone ? 'app-dependency-cross-zone' : 'app-dependency',
          `${info.app.name} (${info.app.file} ${field}) depends on the app ${dep} (${target.app.dir}). ` +
            (crossZone
              ? `Cross-zone dependency: ${info.zone} and ${target.zone} share only packages/*. `
              : `Apps never depend on other apps: shells load remotes at runtime (remotes.json + mfe-manifest.json) and remotes never import remotes. `) +
            `Move shared code to a package in packages/ and remove "${dep}" from ${field}.`,
        );
      }
    }
  }

  // --- app → app imports (source backstop) -------------------------------------------------------
  const appsRoot = path.join(root, 'apps');
  const appDirs = infos.map((i) => ({
    info: i,
    abs: path.join(root, i.app.dir),
  }));
  for (const info of infos) {
    const abs = path.join(root, info.app.dir);
    for (const file of sourceFiles(abs)) {
      const code = fs.readFileSync(file, 'utf8');
      const rel = path.relative(root, file).split(path.sep).join('/');
      for (const match of code.matchAll(IMPORT_RE)) {
        const spec = match[1];
        /** @type {AppInfo | undefined} */
        let target;
        if (spec.startsWith('.') || path.isAbsolute(spec)) {
          const resolved = path.resolve(path.dirname(file), spec);
          if (resolved.startsWith(abs + path.sep) || resolved === abs) continue;
          if (!resolved.startsWith(appsRoot + path.sep)) continue;
          target = appDirs.find(
            (d) => resolved === d.abs || resolved.startsWith(d.abs + path.sep),
          )?.info;
          if (!target) {
            err(
              'app-import',
              `${rel} imports "${spec}", which points outside ${info.app.dir} into apps/. Apps never import each other's files; use a package in packages/.`,
            );
            continue;
          }
        } else {
          target = infos.find(
            (i) => spec === i.app.name || spec.startsWith(`${i.app.name}/`),
          );
          if (!target || target === info) continue;
        }
        const crossZone = target.zone !== info.zone;
        err(
          crossZone ? 'app-import-cross-zone' : 'app-import',
          `${rel} imports "${spec}" from the ${target.zone} ${target.type ?? 'app'} ${target.app.name}. ` +
            (crossZone
              ? `Cross-zone import: ${info.zone} and ${target.zone} share only packages/*. `
              : info.type === 'remote'
                ? 'Remotes never import other remotes or shells. '
                : 'Shells load remotes at runtime with <RemoteApp>, never by import. ') +
            'Move shared code to a package in packages/.',
        );
      }
    }
  }

  // --- shell registries --------------------------------------------------------------------------
  for (const shell of infos.filter((i) => i.type === 'shell')) {
    const shellDir = path.join(root, shell.app.dir);
    const registryFile = path.join(shellDir, 'remotes.json');
    const manifestFile = path.join(shellDir, 'mfe-manifest.dev.json');
    const relRegistry = `${shell.app.dir}/remotes.json`;
    if (!fs.existsSync(registryFile)) {
      err(
        'registry',
        `${relRegistry} is missing (the shell's list of remotes).`,
      );
      continue;
    }
    /** @type {any} */
    let registry;
    try {
      registry = readJson(registryFile);
    } catch (e) {
      err(
        'registry',
        `${relRegistry} is not valid JSON: ${/** @type {Error} */ (e).message}`,
      );
      continue;
    }
    /** @type {any} */
    let manifest = { remotes: {} };
    if (fs.existsSync(manifestFile)) {
      try {
        manifest = readJson(manifestFile);
      } catch (e) {
        err(
          'registry',
          `${shell.app.dir}/mfe-manifest.dev.json is not valid JSON: ${/** @type {Error} */ (e).message}`,
        );
      }
    }
    const entries = Array.isArray(registry.remotes) ? registry.remotes : [];
    /** @type {Set<string>} */
    const registered = new Set();
    for (const entry of entries) {
      const target = byName.get(entry?.package);
      const label = `${relRegistry} entry "${entry?.name}"`;
      if (!target) {
        err(
          'registry',
          `${label}: package ${entry?.package} is not an app in this repo. Remove the entry or fix "package".`,
        );
        continue;
      }
      registered.add(target.app.name);
      if (target.zone !== shell.zone || target.type !== 'remote') {
        err(
          'registry',
          `${label}: ${target.app.name} is a ${target.zone} ${target.type}; the ${shell.zone} shell can only register ${shell.zone} remotes.`,
        );
      }
      if (target.access && entry.access !== target.access) {
        err(
          'registry',
          `${label}: access "${entry.access}" but ${target.app.name} is tagged access:${target.access}. Make them agree.`,
        );
      }
      if (entry.federationName !== target.federationName) {
        err(
          'registry',
          `${label}: federationName "${entry.federationName}" but ${target.app.name} has mfe.federationName "${String(target.federationName)}".`,
        );
      }
      if (!manifest.remotes?.[entry.federationName]) {
        warn(
          'registry',
          `${label}: no entry "${entry.federationName}" in ${shell.app.dir}/mfe-manifest.dev.json, so it cannot load in dev.`,
        );
      }
    }
    for (const remote of infos.filter(
      (i) =>
        i.zone === shell.zone &&
        i.type === 'remote' &&
        !registered.has(i.app.name),
    )) {
      warn(
        'registry',
        `${remote.app.name} (${remote.app.dir}) is not registered in ${relRegistry}, so the ${shell.zone} shell does not show it.`,
      );
    }
  }
  for (const zone of Object.keys(ZONES)) {
    const hasRemote = infos.some((i) => i.zone === zone && i.type === 'remote');
    const hasShell = infos.some((i) => i.zone === zone && i.type === 'shell');
    if (hasRemote && !hasShell) {
      warn(
        'app-shell',
        `Zone ${zone} has remotes but no shell. Run pnpm gen:shell ${zone}.`,
      );
    }
  }

  return { errors, warnings };
}
