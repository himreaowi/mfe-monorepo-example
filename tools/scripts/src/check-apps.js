// @ts-check
/**
 * check-apps: backstop for the Nx module-boundary lint rule.
 *
 * - every app lives at apps/<zone>/<name> and declares its Nx tags (zone, type, access) and a
 *   dev port (`mfe.port`) inside its zone's range; ports and federation names are unique
 * - at most one shell per zone, named shell-<zone>
 * - no app's package.json depends on another app (cross-zone deps reported as such)
 * - no app's source imports another app (by package name or by a relative path)
 * - each shell's remotes.json matches the remotes of its zone, and its generated
 *   mfe-manifest.dev.json is up to date (src/dev-manifest.js)
 * - the dev tool servers declared in the root package.json (`mfe.tools`) have unique offsets
 *   inside the zones' tools range and name existing workspace packages
 * - component layout (docs/coding-conventions.md "One folder per component"): components live in
 *   `features/<feature>/components/<Name>/`, `src/components/<Name>/` or `src/layouts/<Name>/`
 *   with `<Name>.tsx`, `<Name>.test.tsx` and `index.ts`; a CSS module is imported only from its
 *   own folder
 * - remotes never set CSS custom properties page-wide (`:root`, `html`, `body`, `[data-theme]`,
 *   `document.documentElement.style.setProperty('--…')`): that would restyle the shell's layout
 *   and every other remote
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  APP_TAGS,
  FEDERATION_NAME,
  TOOL_NAME,
  TOOL_SLOTS,
  ZONES,
} from './zones.js';
import { loadApps, loadWorkspace, readJson } from './workspace.js';
import { devManifestStatus } from './dev-manifest.js';

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
        `${where}: port ${port} is reserved for the ${zone} dev tools (${range.tools.first}-${range.tools.last}: mock API, mock vendor, root package.json mfe.tools). Apps use ${range.first}-${range.last}.`,
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
 * One folder per component: `components/<Name>/{<Name>.tsx, <Name>.test.tsx, index.ts}` inside
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
          `${rel(path.join(featureDir, file.name))}: components and their styles live in features/${feature.name}/components/<Name>/ (move it to components/${base}/${file.name}). The feature root keeps only api/, hooks/, types/, utils/, components/ and index.ts. See ${LAYOUT_DOC}.`,
        );
      }
    }
  }
  for (const dir of componentDirs) {
    for (const item of entries(dir)) {
      const where = rel(path.join(dir, item.name));
      if (item.isFile() && /^index\.tsx?$/.test(item.name)) continue; // optional barrel
      if (item.isFile()) {
        const base = item.name.replace(
          /\.(test\.)?[jt]sx?$|\.module\.s?css$|\.s?css$/,
          '',
        );
        err(
          'component-folder',
          `${where}: one folder per component; move it to ${rel(dir)}/${base}/${item.name} (with ${base}.test.tsx and an index.ts re-export). Shared test data goes to the feature's __fixtures__/. See ${LAYOUT_DOC}.`,
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
      if (!has('index.ts') && !has('index.tsx')) {
        err(
          'component-folder',
          `${where}/: missing index.ts (export { ${name} } from './${name}';). Import the component through its folder.`,
        );
      }
      if (!has(`${name}.test.tsx`)) {
        err(
          'component-test',
          `${where}/: missing ${name}.test.tsx. Every component has a co-located unit test (docs/testing.md).`,
        );
      }
    }
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
