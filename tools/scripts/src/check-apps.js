// @ts-check
/**
 * check-apps: backstop for the Nx module-boundary lint rule.
 *
 * - every app lives at apps/<zone>/<group>/<folder> (layout.js) and declares its Nx tags (zone, type, access) and a
 *   dev port (`mfe.port`) inside its zone's range; ports and federation names are unique
 * - shells live in apps/<zone>/<shellName>/shell and declare a base path (`mfe.basePath`, default `/`);
 *   a zone can have several shells: their base paths are unique and never nest (at most one at
 *   `/`), and a zone whose shells all sit below `/` names the shell `/` redirects to (root
 *   package.json `mfe.zones.<zone>.defaultShell`)
 * - remote-location: a remote listed by one shell lives in that shell's group folder
 *   (apps/<zone>/<shell>/<remote>), one listed by 2+ shells in apps/<zone>/shared/<remote>
 *   (`pnpm move-remote` moves it); shell-location / group-layout guard the group folders
 * - ports follow the zone plan (src/zones.js): shells x01-x09, remotes x10-x89
 * - no app's package.json depends on another app (cross-zone deps reported as such)
 * - no app's source imports another app (by package name or by a relative path)
 * - each shell's remotes.json matches the remotes of its zone, and its generated
 *   mfe-manifest.dev.json is up to date (src/dev-manifest.js)
 * - the dev tool servers declared in the root package.json (`mfe.tools`) have unique offsets
 *   inside the zones' tools range and name existing workspace packages
 * - component layout (docs/coding-conventions.md "One folder per component"): components live in
 *   `features/<feature>/components/<Name>/`, `src/components/<Name>/` or `src/layouts/<Name>/`
 *   with `<Name>.tsx` and `<Name>.test.tsx`; a CSS module is imported only from its own folder
 * - state folders (`src/features/<feature>/state/`, app-level `src/state/`) hold a tested
 *   reducer: at least one `<name>Reducer.test.ts`
 * - no barrel files: the only `index.ts` in an app is a feature's public API
 *   (`src/features/<feature>/index.ts`); everything else is imported from its file
 *   (`@/components/Card/Card`)
 * - @org/ui component library (packages/platform/ui/src/components/<Name>/): every component folder has
 *   <Name>.tsx, <Name>.module.scss, <Name>.test.tsx and <Name>.stories.tsx
 * - shared components belong in @org/ui: a component folder name (src/components/<Name>,
 *   features/<feature>/components/<Name>) found in two or more apps is an error, unless the
 *   root package.json lists it in `mfe.componentDuplicatesAllowed` ({ "<Name>": "<reason>" })
 * - remotes never set CSS custom properties page-wide (`:root`, `html`, `body`, `[data-theme]`,
 *   `document.documentElement.style.setProperty('--…')`): that would restyle the shell's layout
 *   and every other remote
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  APP_TAGS,
  BASE_PATH,
  FEDERATION_NAME,
  TOOL_NAME,
  TOOL_SLOTS,
  ZONES,
  basePathsOverlap,
  readZoneSettings,
  shellBasePath,
} from './zones.js';
import { loadApps, loadWorkspace, readJson } from './workspace.js';
import { devManifestStatus } from './dev-manifest.js';
import {
  LIBS_GROUP,
  SHARED_GROUP,
  SHELL_FOLDER,
  remoteTarget,
  shellNameFromPackage,
  splitAppDir,
} from './layout.js';

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
 *   group: string | undefined,
 *   shellName: string | undefined,
 *   tags: string[],
 *   type: string | undefined,
 *   access: string | undefined,
 *   port: unknown,
 *   federationName: unknown,
 *   basePath: string,
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
    const parts = splitAppDir(app.dir); // apps/<zone>/<group>/<folder>
    const where = `${app.name} (${app.file})`;
    if (!parts) {
      err(
        'app-location',
        `${where}: apps must live at apps/<zone>/<shell>/shell (a shell), apps/<zone>/<shell>/<remote> or apps/<zone>/shared/<remote> (zone: ${Object.keys(ZONES).join(' | ')}). Move it, or generate apps with pnpm gen:shell / pnpm gen:remote.`,
      );
      continue;
    }
    const { zone, group, folder: dirName } = parts;
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
    const shellName =
      type === 'shell' ? shellNameFromPackage(app.name) : undefined;
    if (type === 'shell') {
      if (group === SHARED_GROUP) {
        err(
          'shell-location',
          `${where}: ${app.dir} is a shell in apps/${zone}/${SHARED_GROUP}/, which is only for remotes listed by 2+ shells. Move it to apps/${zone}/<shellName>/${SHELL_FOLDER}.`,
        );
      } else if (dirName !== SHELL_FOLDER) {
        err(
          'shell-location',
          `${where}: a shell lives in apps/${zone}/<shellName>/${SHELL_FOLDER} (found ${app.dir}); pnpm gen:shell ${zone} <name> creates one.`,
        );
      } else if (shellName === undefined) {
        err(
          'shell-location',
          `${where}: a shell package is named @<scope>/shell-<shellName> (found ${app.name}).`,
        );
      } else if (group !== shellName) {
        err(
          'shell-location',
          `${where}: the group folder is named after the shell: package ${app.name} belongs in apps/${zone}/${shellName}/${SHELL_FOLDER}, found ${app.dir}. Move it: git mv apps/${zone}/${group} apps/${zone}/${shellName} (or rename the package).`,
        );
      }
    } else if (dirName === SHELL_FOLDER) {
      err(
        'shell-location',
        `${where}: the folder name "${SHELL_FOLDER}" is reserved for the shell of a group (found ${app.dir}).`,
      );
    }
    const rawBasePath = app.pkg.mfe?.basePath;
    if (type === 'shell') {
      if (
        rawBasePath !== undefined &&
        (typeof rawBasePath !== 'string' || !BASE_PATH.test(rawBasePath))
      ) {
        err(
          'app-base-path',
          `${where}: "mfe.basePath" must be "/" or a path like "/citizen" (lowercase letters, digits and "-" per segment, no trailing slash), found ${JSON.stringify(rawBasePath)}.`,
        );
      }
    } else if (rawBasePath !== undefined) {
      err(
        'app-base-path',
        `${where}: "mfe.basePath" is a shell setting; a remote is mounted below the path of each shell that lists it in remotes.json. Remove it.`,
      );
    }

    const port = app.pkg.mfe?.port;
    const range = ZONES[/** @type {keyof typeof ZONES} */ (zone)];
    const own = type === 'shell' ? range.shells : range.remotes;
    const ownLabel = type === 'shell' ? 'shells' : 'remotes';
    const plan = `${zone} ports: dev proxy ${range.proxy}, shells ${range.shells.first}-${range.shells.last}, remotes ${range.remotes.first}-${range.remotes.last}, tools ${range.tools.first}-${range.tools.last}`;
    if (!Number.isInteger(port)) {
      err(
        'app-port',
        `${where}: missing "mfe": { "port": <number> } (${ownLabel} of the ${zone} zone use ${own.first}-${own.last}).`,
      );
    } else if (port >= range.tools.first && port <= range.tools.last) {
      err(
        'app-port',
        `${where}: port ${port} is reserved for the ${zone} dev tools (mock API, mock vendor, root package.json mfe.tools). ${plan}.`,
      );
    } else if (port === range.proxy) {
      err(
        'app-port',
        `${where}: port ${port} is the ${zone} dev proxy (pnpm dev:${zone} serves every shell there under its base path). ${plan}.`,
      );
    } else if (type && (port < own.first || port > own.last)) {
      err(
        'app-port',
        `${where}: port ${port} is outside the ${zone} ${ownLabel} range ${own.first}-${own.last} (${plan}). Pick a free port in the range.`,
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
      group,
      shellName,
      tags,
      type,
      access: accesses[0],
      port,
      federationName,
      basePath: shellBasePath(rawBasePath),
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
      `Dev port ${port} is used by ${list.length} apps: ${names(list)}. Each app needs its own port; change "mfe.port" of all but one (then pnpm dev-manifest regenerates the shell's mfe-manifest.dev.json).`,
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
  // --- shells of a zone: base paths, default shell -------------------------------------------
  const zoneSettings = readZoneSettings(root);
  for (const zone of Object.keys(ZONES)) {
    const shells = infos.filter((i) => i.zone === zone && i.type === 'shell');
    for (let a = 0; a < shells.length; a += 1) {
      for (let b = a + 1; b < shells.length; b += 1) {
        const [x, y] = [shells[a], shells[b]];
        if (basePathsOverlap(x.basePath, y.basePath)) {
          err(
            'app-base-path',
            `${x.app.name} (base path ${x.basePath}) and ${y.app.name} (base path ${y.basePath}) overlap: shells of the ${zone} zone share one origin, so each needs its own base path and none may sit inside another (at most one at "/"). Change "mfe.basePath" in one of them.`,
          );
        }
      }
    }
    const settings = Object.hasOwn(zoneSettings, zone)
      ? zoneSettings[zone]
      : undefined;
    const defaultShell = settings?.defaultShell;
    const shellNames = shells.map((i) => i.shellName ?? String(i.group));
    const hasRoot = shells.some((i) => i.basePath === '/');
    if (defaultShell !== undefined) {
      if (
        typeof defaultShell !== 'string' ||
        !shellNames.includes(defaultShell)
      ) {
        err(
          'zone-default-shell',
          `Root package.json "mfe.zones.${zone}.defaultShell" is ${JSON.stringify(defaultShell)}, which is not a ${zone} shell (${shellNames.length ? shellNames.join(', ') : 'none yet'}). Use the shell's name (apps/${zone}/<name>/shell).`,
        );
      } else if (hasRoot) {
        err(
          'zone-default-shell',
          `Root package.json "mfe.zones.${zone}.defaultShell" is set, but a ${zone} shell already sits at "/". Remove the setting (it only says where "/" redirects when no shell owns it).`,
        );
      }
    } else if (shells.length > 0 && !hasRoot) {
      err(
        'zone-default-shell',
        `No ${zone} shell has base path "/": set where "/" redirects in the root package.json, "mfe": { "zones": { "${zone}": { "defaultShell": "<${shellNames.join(' | ')}>" } } }.`,
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
  /** Remotes listed by at least one shell (a remote may be listed by several shells of its zone). */
  /** @type {Set<string>} */
  const registeredInZone = new Set();
  /** @type {Map<string, Set<string>>} remote package → names of the shells listing it */
  const listedBy = new Map();
  for (const shell of infos.filter((i) => i.type === 'shell')) {
    const shellDir = path.join(root, shell.app.dir);
    const registryFile = path.join(shellDir, 'remotes.json');
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
          `${label}: ${target.app.name} is a ${target.zone} ${target.type}; ${shell.app.name} (a ${shell.zone} shell) can only register ${shell.zone} remotes.`,
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
    }
    for (const name of registered) {
      registeredInZone.add(name);
      const target = byName.get(name);
      if (!target || target.zone !== shell.zone || target.type !== 'remote')
        continue;
      const set = listedBy.get(name) ?? new Set();
      set.add(shell.shellName ?? String(shell.group));
      listedBy.set(name, set);
    }
  }
  for (const remote of infos.filter(
    (i) =>
      i.type === 'remote' &&
      !registeredInZone.has(i.app.name) &&
      infos.some((s) => s.type === 'shell' && s.zone === i.zone),
  )) {
    warn(
      'remote-location',
      `${remote.app.name} (${remote.app.dir}) is not registered in the remotes.json of any ${remote.zone} shell, so no shell shows it (unused). Register it, or delete it.`,
    );
  }
  for (const remote of infos.filter((i) => i.type === 'remote')) {
    const target = remoteTarget(
      String(remote.zone),
      String(remote.dirName),
      [...(listedBy.get(remote.app.name) ?? [])].sort(),
    );
    if (!target || target.dir === remote.app.dir) continue;
    const by = [...(listedBy.get(remote.app.name) ?? [])].sort();
    err(
      'remote-location',
      `${remote.app.name} is listed by ${by.length === 1 ? `the ${by[0]} shell` : `${by.length} ${remote.zone} shells (${by.join(', ')})`} so it belongs in ${target.dir} (found ${remote.app.dir}). Move it: pnpm move-remote ${remote.zone} ${remote.dirName} --to ${target.to}  (or: git mv ${remote.app.dir} ${target.dir} && pnpm install).`,
    );
  }
  // --- group folders: one shell each, nothing unknown below a zone ---------------------------
  for (const zone of Object.keys(ZONES)) {
    const zoneDir = path.join(root, 'apps', zone);
    for (const item of entries(zoneDir)) {
      if (item.name === 'node_modules') continue;
      if (!item.isDirectory()) {
        if (item.name === 'README.md' || item.name.startsWith('.env')) continue;
        err(
          'group-layout',
          `apps/${zone}/${item.name}: unknown item. Below a zone only .env* files, README.md, the portal folders (apps/${zone}/<portal>/), apps/${zone}/${SHARED_GROUP}/ (remotes of 2+ portals) and apps/${zone}/${LIBS_GROUP}/ (code libraries) are allowed.`,
        );
        continue;
      }
      const dir = `apps/${zone}/${item.name}`;
      const inGroup = infos.filter(
        (i) => i.zone === zone && i.group === item.name,
      );
      const shellsHere = inGroup.filter((i) => i.type === 'shell');
      // apps/<zone>/libs/ holds code libraries (check-packages.js), no apps
      if (item.name === SHARED_GROUP || item.name === LIBS_GROUP) continue;
      if (shellsHere.length !== 1) {
        err(
          'group-layout',
          `${dir}: a portal folder holds exactly one shell in ${dir}/${SHELL_FOLDER}/, found ${shellsHere.length}. Portal folders are named after their shell; remotes listed by 2+ shells go to apps/${zone}/${SHARED_GROUP}/, code shared by the zone's apps to apps/${zone}/${LIBS_GROUP}/<capability> (pnpm gen:package ${zone} <capability>).`,
        );
      }
    }
  }
  // --- generated dev manifests ---------------------------------------------------------------
  for (const shell of infos.filter((i) => i.type === 'shell')) {
    const shellDir = path.join(root, shell.app.dir);
    if (!fs.existsSync(path.join(shellDir, 'remotes.json'))) continue;
    const devManifest = shell.app.pkg.mfe?.devManifest;
    if (
      devManifest !== undefined &&
      (typeof devManifest !== 'object' ||
        devManifest === null ||
        Array.isArray(devManifest) ||
        ('remotes' in devManifest &&
          (typeof devManifest.remotes !== 'object' ||
            devManifest.remotes === null ||
            Array.isArray(devManifest.remotes))))
    ) {
      err(
        'dev-manifest',
        `${shell.app.file}: "mfe.devManifest" must be an object like { "auth": { "mock": true }, "settings": { … }, "remotes": { "<federationName>": { "props": { … } } } }.`,
      );
      continue;
    }
    const status = devManifestStatus(root, shellDir);
    if (status.upToDate) continue;
    const file = `${shell.app.dir}/mfe-manifest.dev.json`;
    err(
      'dev-manifest',
      `${file} ${status.missing ? 'is missing' : status.invalid ? `is not valid JSON (${status.invalid})` : 'is out of date'}. It is generated from remotes.json, the remotes' package.json "mfe.port" and the shell's package.json "mfe.devManifest" (auth, settings, per-remote dev props): run pnpm dev-manifest (the shell's dev script, pnpm e2e and the generators also do). Do not edit it by hand; put extra dev props in "mfe.devManifest" of ${shell.app.file}.`,
    );
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

  // --- component layout (one folder per component) -------------------------------------------
  for (const info of infos) {
    checkComponentLayout(root, path.join(root, info.app.dir), err);
  }

  // --- the page (tokens, shell layout) belongs to the shell --------------------------------------
  for (const info of infos.filter((i) => i.type === 'remote')) {
    checkGlobalTokens(root, path.join(root, info.app.dir), err);
  }

  // --- dev tool servers (root package.json mfe.tools) ---------------------------------------
  checkTools(root, err);

  // --- component library (@org/ui) and components duplicated across apps ------------------------
  checkUiLibrary(root, err);
  checkDuplicateComponents(root, infos, err);

  return { errors, warnings };
}

const CSS_MODULE = /\.module\.s?css$/;
const COMPONENT_NAME = /^[A-Z][A-Za-z0-9]*$/;
const LAYOUT_DOC = 'docs/coding-conventions.md ("One folder per component")';

/**
 * @param {string} dir
 * @returns {fs.Dirent[]}
 */
function entries(dir) {
  return fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : [];
}

/**
 * One folder per component: `components/<Name>/{<Name>.tsx, <Name>.test.tsx}` inside
 * `src/components/`, `src/layouts/` (the shell's ShellLayout, a remote's StandaloneLayout) and
 * every `src/features/<feature>/components/`; no component or style files
 * loose in a feature root or a components/ folder; a CSS module is private to its folder (no
 * styles shared between components through one .module.scss).
 * @param {string} root
 * @param {string} appDir absolute
 * @param {(rule: string, message: string) => void} err
 */
function checkComponentLayout(root, appDir, err) {
  const src = path.join(appDir, 'src');
  const rel = (/** @type {string} */ file) =>
    path.relative(root, file).split(path.sep).join('/');
  /** @type {string[]} */
  const componentDirs = [
    path.join(src, 'components'),
    path.join(src, 'layouts'),
  ];
  for (const feature of entries(path.join(src, 'features'))) {
    if (!feature.isDirectory()) continue;
    const featureDir = path.join(src, 'features', feature.name);
    componentDirs.push(path.join(featureDir, 'components'));
    for (const file of entries(featureDir)) {
      if (
        file.isFile() &&
        /\.(tsx|s?css)$/.test(file.name) &&
        !/^index\.tsx$/.test(file.name)
      ) {
        const base = file.name.replace(/\.(test\.)?tsx$|\.module\.s?css$/, '');
        err(
          'component-folder',
          `${rel(path.join(featureDir, file.name))}: components and their styles live in features/${feature.name}/components/<Name>/ (move it to components/${base}/${file.name}). The feature root keeps only api/, hooks/, state/, types/, utils/, components/ and index.ts. See ${LAYOUT_DOC}.`,
        );
      }
    }
  }
  for (const dir of componentDirs) {
    for (const item of entries(dir)) {
      const where = rel(path.join(dir, item.name));
      if (item.isFile() && /^index\.tsx?$/.test(item.name)) continue; // barrel-file rule
      if (item.isFile()) {
        const base = item.name.replace(
          /\.(test\.)?[jt]sx?$|\.module\.s?css$|\.s?css$/,
          '',
        );
        err(
          'component-folder',
          `${where}: one folder per component; move it to ${rel(dir)}/${base}/${item.name} (with ${base}.test.tsx). Shared test data goes to the feature's __fixtures__/. See ${LAYOUT_DOC}.`,
        );
        continue;
      }
      if (!item.isDirectory()) continue;
      const name = item.name;
      const folder = path.join(dir, name);
      if (name.startsWith('__')) {
        err(
          'component-folder',
          `${where}/: test data and helpers shared by several components go to the feature's __fixtures__/ (or utils/), not inside components/. See ${LAYOUT_DOC}.`,
        );
        continue;
      }
      const has = (/** @type {string} */ f) =>
        fs.existsSync(path.join(folder, f));
      if (!COMPONENT_NAME.test(name) || !has(`${name}.tsx`)) {
        err(
          'component-folder',
          `${where}/: a component folder is named after its component (PascalCase) and contains ${name}.tsx. See ${LAYOUT_DOC}.`,
        );
        continue;
      }
      if (!has(`${name}.test.tsx`)) {
        err(
          'component-test',
          `${where}/: missing ${name}.test.tsx. Every component has a co-located unit test (docs/testing.md).`,
        );
      }
    }
  }

  // state folders hold a reducer with its test (docs/coding-conventions.md "State management")
  const stateDirs = [
    path.join(src, 'state'),
    ...entries(path.join(src, 'features'))
      .filter((feature) => feature.isDirectory())
      .map((feature) => path.join(src, 'features', feature.name, 'state')),
  ].filter((dir) => fs.existsSync(dir));
  for (const dir of stateDirs) {
    const files = entries(dir)
      .filter((f) => f.isFile())
      .map((f) => f.name);
    if (files.some((f) => /Reducer\.test\.tsx?$/.test(f))) continue;
    const reducer = files.find((f) => /Reducer\.tsx?$/.test(f));
    err(
      'state-test',
      `${rel(dir)}/: a state/ folder holds a pure reducer and its test (${reducer ? reducer.replace(/\.tsx?$/, '.test.ts') : '<name>Reducer.ts + <name>Reducer.test.ts'}) next to the <Name>Context.tsx that provides it. See docs/coding-conventions.md ("State management").`,
    );
  }

  // no barrel files: index.ts only as a feature's public API (src/features/<feature>/index.ts)
  for (const file of sourceFiles(appDir)) {
    if (!/^index\.tsx?$/.test(path.basename(file))) continue;
    const parent = path.dirname(file);
    const isFeatureApi =
      path.dirname(parent) === path.join(src, 'features') &&
      path.basename(file) === 'index.ts';
    if (isFeatureApi) continue;
    err(
      'barrel-file',
      `${rel(file)}: no index.ts barrels. Import from the file itself (e.g. '@/components/Card/Card', '../api/itemsApi'); the only index.ts in an app is a feature's public API, src/features/<feature>/index.ts. See ${LAYOUT_DOC}.`,
    );
  }

  // CSS modules are private to their folder
  for (const file of sourceFiles(appDir)) {
    const code = fs.readFileSync(file, 'utf8');
    for (const match of code.matchAll(IMPORT_RE)) {
      const spec = match[1];
      if (!CSS_MODULE.test(spec)) continue;
      let resolved;
      if (spec.startsWith('@/')) resolved = path.join(src, spec.slice(2));
      else if (spec.startsWith('.')) {
        resolved = path.resolve(path.dirname(file), spec);
      } else continue;
      if (path.dirname(resolved) === path.dirname(file)) continue;
      err(
        'component-style',
        `${rel(file)} imports "${spec}" from another folder. A CSS module belongs to the component in its folder and is never shared: give this component its own ${path.basename(file).replace(/\.[jt]sx?$/, '')}.module.scss with only the rules it uses. Shared values come from tokens (var(--…)); a style two components really share becomes a small shared component or a Sass partial (_name.scss, @use). See ${LAYOUT_DOC}.`,
      );
    }
  }
}

/** Source and style files under src/ (styles included, unlike `sourceFiles`). */
function styleAndSourceFiles(/** @type {string} */ dir) {
  const src = path.join(dir, 'src');
  if (!fs.existsSync(src)) return [];
  return fs
    .readdirSync(src, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile() && /\.(?:[cm]?[jt]sx?|s?css)$/.test(d.name))
    .map((d) => path.join(d.parentPath, d.name))
    .filter((f) => !f.includes(`${path.sep}node_modules${path.sep}`));
}

/** A selector that reaches the whole page: everything (the shell's layout too) inherits from it. */
const PAGE_SELECTOR = /:root\b|(?:^|[\s>+~,(])(?:html|body)\b|\[data-theme\b/;

/** Setting a custom property on the document from script. */
const PAGE_SET_PROPERTY =
  /(?:documentElement|document\.body)\s*\.style\s*\.setProperty\(\s*['"`](--[\w-]+)/;

/**
 * Custom property declarations (`--name: …`) whose selector chain reaches the whole page
 * (`:root`, `html`, `body`, `[data-theme…]`) without a class that scopes it to the app's own
 * elements (`.card`, outside `:global(…)`). At-rules (`@media`, `@supports`, …) are transparent.
 * @param {string} css
 * @returns {{ name: string, selector: string }[]}
 */
export function pageWideCustomProperties(css) {
  const code = css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"])\/\/.*$/gm, '$1')
    // Sass interpolation (`#{$width}`) is not a block
    .replace(/#\{[^}]*\}/g, 'x');
  /** @type {{ name: string, selector: string }[]} */
  const found = [];
  /** @type {string[]} */
  const stack = [];
  let buffer = '';
  const declaration = () => {
    const match = /^\s*(--[\w-]+)\s*:/.exec(buffer);
    buffer = '';
    if (!match) return;
    const chain = stack.filter((selector) => !selector.startsWith('@'));
    if (!chain.some((selector) => PAGE_SELECTOR.test(selector))) return;
    const scoped = chain.some((selector) =>
      /\.[A-Za-z_-]/.test(selector.replace(/:global\([^)]*\)/g, '')),
    );
    if (!scoped) found.push({ name: match[1], selector: chain.join(' ') });
  };
  for (const ch of code) {
    if (ch === '{') {
      stack.push(buffer.trim());
      buffer = '';
    } else if (ch === '}') {
      declaration();
      stack.pop();
    } else if (ch === ';') {
      declaration();
    } else {
      buffer += ch;
    }
  }
  return found;
}

/**
 * The page belongs to the shell: its tokens (`--color-*`, …) and its own layout, which reads
 * them. A remote that sets custom properties page-wide would restyle the shell's header and
 * every other remote whenever it is loaded (and differently per remote). Component-scoped
 * custom properties (`.card { --gap: … }`) are fine. Test files are skipped.
 * @param {string} root
 * @param {string} appDir absolute
 * @param {(rule: string, message: string) => void} err
 */
function checkGlobalTokens(root, appDir, err) {
  for (const file of styleAndSourceFiles(appDir)) {
    if (/\.test\.[cm]?[jt]sx?$/.test(file)) continue;
    const code = fs.readFileSync(file, 'utf8');
    const rel = path.relative(root, file).split(path.sep).join('/');
    const hint =
      'A remote never sets custom properties for the whole page: they would restyle the shell\'s layout and every other remote whenever it is loaded. Scope it to your component (`.myClass { --x: … }`), or ask for a token in @org/design-tokens (docs/ui-context.md "Layout: the shell owns it").';
    if (/\.s?css$/.test(file)) {
      const [first] = pageWideCustomProperties(code);
      if (first) {
        err(
          'remote-global-tokens',
          `${rel} sets ${first.name} on "${first.selector}". ${hint}`,
        );
      }
      continue;
    }
    const match = PAGE_SET_PROPERTY.exec(code);
    if (match) {
      err(
        'remote-global-tokens',
        `${rel} sets ${match[1]} on the document (style.setProperty). ${hint}`,
      );
    }
  }
}

/** Ports a tool offset maps to, in every zone (e.g. "3192 / 3292"). */
function toolPorts(/** @type {number} */ offset) {
  return Object.values(ZONES)
    .map((z) => z.tools.first + offset)
    .join(' / ');
}

/**
 * Root package.json `mfe.tools`: `{ "<name>": { "offset": 0-9, "package"?: "<workspace pkg>" } }`.
 * @param {string} root
 * @param {(rule: string, message: string) => void} err
 */
function checkTools(root, err) {
  const file = path.join(root, 'package.json');
  if (!fs.existsSync(file)) return;
  const tools = readJson(file).mfe?.tools;
  if (tools === undefined) return;
  const ranges = Object.entries(ZONES)
    .map(([zone, z]) => `${zone} ${z.tools.first}-${z.tools.last}`)
    .join(', ');
  const shape = `"mfe": { "tools": { "<name>": { "offset": <0-${TOOL_SLOTS - 1}>, "package": "<workspace package>" } } }`;
  if (typeof tools !== 'object' || tools === null || Array.isArray(tools)) {
    err('tool-config', `package.json "mfe.tools" must be an object: ${shape}.`);
    return;
  }
  const packageNames = new Set(loadWorkspace(root).packages.map((p) => p.name));
  /** @type {Map<number, string[]>} */
  const byOffset = new Map();
  for (const [name, config] of Object.entries(tools)) {
    const where = `package.json mfe.tools.${name}`;
    if (!TOOL_NAME.test(name)) {
      err(
        'tool-config',
        `${where}: tool names are JS identifiers (camelCase, e.g. exampleVendor).`,
      );
    }
    if (
      typeof config !== 'object' ||
      config === null ||
      Array.isArray(config)
    ) {
      err('tool-config', `${where}: must be an object: ${shape}.`);
      continue;
    }
    const unknown = Object.keys(config).filter(
      (k) => !['offset', 'package', 'description'].includes(k),
    );
    if (unknown.length > 0) {
      err(
        'tool-config',
        `${where}: unknown field(s) ${unknown.join(', ')} (allowed: offset, package, description).`,
      );
    }
    const { offset } = config;
    if (
      typeof offset !== 'number' ||
      !Number.isInteger(offset) ||
      offset < 0 ||
      offset >= TOOL_SLOTS
    ) {
      err(
        'tool-port',
        `${where}: "offset" must be an integer 0-${TOOL_SLOTS - 1}, found ${JSON.stringify(offset)}. The port is the zone's first tools port + offset (${ranges}).`,
      );
    } else {
      byOffset.set(offset, [...(byOffset.get(offset) ?? []), name]);
    }
    if (config.package !== undefined) {
      if (
        typeof config.package !== 'string' ||
        !packageNames.has(config.package)
      ) {
        err(
          'tool-config',
          `${where}: "package" ${JSON.stringify(config.package)} is not a workspace package (the tool's package.json "name").`,
        );
      }
    }
  }
  for (const [offset, names] of byOffset) {
    if (names.length > 1) {
      err(
        'tool-port-duplicate',
        `package.json mfe.tools: ${names.join(', ')} all use offset ${offset} (port ${toolPorts(offset)}). Give each tool its own offset (free: ${
          Array.from({ length: TOOL_SLOTS }, (_, i) => i)
            .filter((i) => !byOffset.has(i))
            .join(', ') || 'none'
        }).`,
      );
    }
  }
}

const UI_DOC = 'packages/platform/ui/README.md ("Adding a component")';

/**
 * @org/ui: `src/components/<Name>/` holds `<Name>.tsx`, `<Name>.module.scss`, `<Name>.test.tsx`
 * and `<Name>.stories.tsx` (Storybook, dev only; the a11y and visual tests run every story).
 * @param {string} root
 * @param {(rule: string, message: string) => void} err
 */
function checkUiLibrary(root, err) {
  const ui = loadWorkspace(root).packages.find((p) => p.name === '@org/ui');
  if (!ui) return;
  const dir = path.join(root, ui.dir, 'src', 'components');
  for (const item of entries(dir)) {
    const where = path
      .relative(root, path.join(dir, item.name))
      .split(path.sep)
      .join('/');
    if (!item.isDirectory()) {
      err(
        'ui-component-files',
        `${where}: @org/ui has one folder per component (src/components/<Name>/). See ${UI_DOC}.`,
      );
      continue;
    }
    const name = item.name;
    const missing = [
      `${name}.tsx`,
      `${name}.module.scss`,
      `${name}.test.tsx`,
      `${name}.stories.tsx`,
    ].filter((f) => !fs.existsSync(path.join(dir, name, f)));
    if (!COMPONENT_NAME.test(name) || missing.length > 0) {
      err(
        'ui-component-files',
        `${where}/: an @org/ui component folder is named after its component (PascalCase) and has ${name}.tsx, ${name}.module.scss, ${name}.test.tsx and ${name}.stories.tsx${missing.length > 0 ? ` (missing: ${missing.join(', ')})` : ''}. See ${UI_DOC}.`,
      );
    }
  }
}

/**
 * Component folders of an app (`src/components/<Name>/` and
 * `src/features/<feature>/components/<Name>/` with `<Name>.tsx`). Layouts (`src/layouts/`) are
 * per app by design (each shell owns its ShellLayout) and are not counted.
 * @param {string} appDir absolute
 * @returns {string[]}
 */
function appComponentNames(appDir) {
  const src = path.join(appDir, 'src');
  const dirs = [path.join(src, 'components')];
  for (const feature of entries(path.join(src, 'features'))) {
    if (feature.isDirectory()) {
      dirs.push(path.join(src, 'features', feature.name, 'components'));
    }
  }
  return dirs.flatMap((dir) =>
    entries(dir)
      .filter(
        (d) =>
          d.isDirectory() &&
          COMPONENT_NAME.test(d.name) &&
          fs.existsSync(path.join(dir, d.name, `${d.name}.tsx`)),
      )
      .map((d) => d.name),
  );
}

/**
 * A simple heuristic for "this should be in @org/ui": the same component folder name in two or
 * more apps (copies drift apart: fixes and a11y improvements land in one copy only). Intentional
 * per-app copies (e.g. generator-owned components each app edits) are listed in the root
 * package.json `mfe.componentDuplicatesAllowed`: `{ "<Name>": "<why each app has its own>" }`.
 * @param {string} root
 * @param {AppInfo[]} infos
 * @param {(rule: string, message: string) => void} err
 */
function checkDuplicateComponents(root, infos, err) {
  const file = path.join(root, 'package.json');
  const allowed = fs.existsSync(file)
    ? readJson(file).mfe?.componentDuplicatesAllowed
    : undefined;
  const shape = `"mfe": { "componentDuplicatesAllowed": { "<ComponentName>": "<reason>" } }`;
  if (
    allowed !== undefined &&
    (typeof allowed !== 'object' ||
      allowed === null ||
      Array.isArray(allowed) ||
      Object.values(allowed).some((v) => typeof v !== 'string' || v === ''))
  ) {
    err(
      'component-duplicates-config',
      `package.json "mfe.componentDuplicatesAllowed" must map component names to a reason: ${shape}.`,
    );
    return;
  }
  /** @type {Map<string, string[]>} */
  const byName = new Map();
  /** @type {Map<string, string | undefined>} app dir → zone */
  const zoneOf = new Map(infos.map((i) => [i.app.dir, i.zone]));
  for (const info of infos) {
    for (const name of new Set(
      appComponentNames(path.join(root, info.app.dir)),
    )) {
      byName.set(name, [...(byName.get(name) ?? []), info.app.dir]);
    }
  }
  for (const [name, dirs] of [...byName].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (dirs.length < 2 || (allowed && Object.hasOwn(allowed, name))) continue;
    const zones = new Set(dirs.map((d) => zoneOf.get(d)));
    const [zone] = zones;
    const where =
      zones.size === 1 && zone
        ? `the ${zone} zone library apps/${zone}/${LIBS_GROUP}/<capability> (pnpm gen:package ${zone} <capability>, then pnpm move-component <app> ${name} --to ${zone}/${LIBS_GROUP}/<capability>)`
        : `packages/common/<capability> when it is business logic both zones may use (it ships to the public internet portals; pnpm gen:package common <capability>, then pnpm move-component <app> ${name} --to common/<capability>)`;
    err(
      'shared-component',
      `component ${name} exists in ${dirs.length} apps (${dirs.join(', ')}). Share one copy: move it to ${where}, or to @org/ui (packages/platform/ui/src/components/${name}/, see ${UI_DOC}) when it is generic UI with no business rules. See docs/where-code-goes.md. If each app needs its own version, rename them or list it in the root ${shape}.`,
    );
  }
}
