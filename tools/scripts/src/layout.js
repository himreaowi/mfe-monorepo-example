// @ts-check
/**
 * Where apps and code packages live (single source for checks, tools and generators):
 *
 *   apps/<zone>/.env.example                  zone-level env (unchanged)
 *   apps/<zone>/<portal>/shell/               the shell app of a portal (package @org/shell-<portal>)
 *   apps/<zone>/<portal>/.env.example         portal-level env override
 *   apps/<zone>/<portal>/<remote>/            a remote listed only by that portal's shell
 *   apps/<zone>/shared/<remote>/              a remote listed by two or more shells of the zone
 *   apps/<zone>/libs/<capability>/            code shared by the zone's apps (@org/<zone>-<capability>),
 *                                             never deployed alone
 *   packages/common/<capability>/             business logic for both zones (@org/common-<capability>);
 *                                             ships to the public internet portals
 *   packages/platform/<name>/                 plumbing (@org/ui, configs, runtime, …)
 *
 * Portal folders (internally "group folders") are named after their shell (dynamic: nothing here
 * knows any portal name); `shared` and `libs` are reserved. The check `remote-location`
 * (check-apps.js) enforces the app placement, `package-boundaries` (check-packages.js) the
 * imports between the layers.
 */
import path from 'node:path';

/** The folder of a shell app inside its group folder. */
export const SHELL_FOLDER = 'shell';
/** Group folder of remotes listed by two or more shells of a zone (not a valid shell name). */
export const SHARED_GROUP = 'shared';

/** Folder of a zone's code libraries (`apps/<zone>/libs/<capability>`): not a portal. */
export const LIBS_GROUP = 'libs';
/** Folder names below `apps/<zone>/` that are not portals (never a shell or remote name). */
export const RESERVED_GROUPS = /** @type {const} */ ([
  SHARED_GROUP,
  LIBS_GROUP,
]);
/** Cross-zone business logic (`@org/common-<capability>`). */
export const COMMON_DIR = 'packages/common';
/** Plumbing packages (`@org/ui`, configs, runtime). */
export const PLATFORM_DIR = 'packages/platform';
/** npm scope of every package of the workspace. */
export const SCOPE = '@org';

/**
 * Package name of a code library: `@org/common-<capability>` (target `common`) or
 * `@org/<zone>-<capability>` (target = zone).
 * @param {string} target `common` or a zone
 * @param {string} capability
 */
export function libraryPackageName(target, capability) {
  return `${SCOPE}/${target}-${capability}`;
}

/**
 * Folder of a code library (relative to the root, POSIX).
 * @param {string} target `common` or a zone
 * @param {string} capability
 */
export function libraryDir(target, capability) {
  return target === 'common'
    ? `${COMMON_DIR}/${capability}`
    : `apps/${target}/${LIBS_GROUP}/${capability}`;
}

/**
 * The layer of a workspace package, from its folder (relative, POSIX):
 * - `platform`: packages/platform/<name>
 * - `common`: packages/common/<capability>
 * - `lib`: apps/<zone>/libs/<capability> (`zone` set)
 * - `app`: any other folder below apps/ (`zone` set when the zone folder is known by name only)
 * - `tool`: tools/<name>; `root`: the root package; `other`: anything else (misplaced)
 * `name` is the last folder (capability / package folder).
 * @param {string} dir
 * @returns {{ layer: 'platform' | 'common' | 'lib' | 'app' | 'tool' | 'root' | 'other', zone?: string, name?: string, depthOk: boolean }}
 *   `depthOk`: the folder sits exactly at the expected depth
 */
export function packageLayer(dir) {
  if (dir === '.' || dir === '') return { layer: 'root', depthOk: true };
  const parts = dir.split('/');
  const name = parts.at(-1);
  if (parts[0] === 'packages') {
    if (parts[1] === 'platform') {
      return { layer: 'platform', name, depthOk: parts.length === 3 };
    }
    if (parts[1] === 'common') {
      return { layer: 'common', name, depthOk: parts.length === 3 };
    }
    return { layer: 'other', name, depthOk: false };
  }
  if (parts[0] === 'apps') {
    if (parts[2] === LIBS_GROUP) {
      return {
        layer: 'lib',
        zone: parts[1],
        name,
        depthOk: parts.length === 4,
      };
    }
    return { layer: 'app', zone: parts[1], name, depthOk: parts.length === 4 };
  }
  if (parts[0] === 'tools') {
    return { layer: 'tool', name, depthOk: parts.length === 2 };
  }
  return { layer: 'other', name, depthOk: false };
}

/** Shell package names: `@<scope>/shell-<shellName>`. */
const SHELL_PACKAGE = /^@[^/]+\/shell-(.+)$/;

/**
 * Shell name from its package name (`@org/shell-staff` → `staff`).
 * @param {string} packageName
 * @returns {string | undefined}
 */
export function shellNameFromPackage(packageName) {
  return SHELL_PACKAGE.exec(packageName)?.[1];
}

/**
 * Parts of an app directory `apps/<zone>/<group>/<folder>` (POSIX, relative to the root).
 * @param {string} dir
 * @returns {{ zone: string, group: string, folder: string } | undefined}
 */
export function splitAppDir(dir) {
  const parts = dir.split('/');
  if (parts.length !== 4 || parts[0] !== 'apps') return undefined;
  return { zone: parts[1], group: parts[2], folder: parts[3] };
}

/**
 * Where a remote belongs, from the names of the shells that list it.
 * @param {string} zone
 * @param {string} folder the remote's folder name
 * @param {string[]} listedBy shell names (distinct)
 * @returns {{ group: string, dir: string, to: string } | undefined} `undefined` when no shell
 *   lists it. `to` is the argument of `pnpm move-remote --to`.
 */
export function remoteTarget(zone, folder, listedBy) {
  if (listedBy.length === 0) return undefined;
  const group = listedBy.length === 1 ? listedBy[0] : SHARED_GROUP;
  return { group, dir: `apps/${zone}/${group}/${folder}`, to: group };
}

/**
 * The group folder (shell-level `.env*` files live there) of a shell directory.
 * @param {string} shellDir absolute or relative path of `.../<group>/shell`
 */
export function shellGroupDir(shellDir) {
  return path.dirname(shellDir);
}
