// @ts-check
/**
 * Where apps live (single source for checks, tools and generators):
 *
 *   apps/<zone>/.env.example                  zone-level env (unchanged)
 *   apps/<zone>/<shellName>/shell/            the shell app (package @org/shell-<shellName>)
 *   apps/<zone>/<shellName>/.env.example      shell-level env override
 *   apps/<zone>/<shellName>/<remote>/         a remote listed only by that shell
 *   apps/<zone>/shared/<remote>/              a remote listed by two or more shells of the zone
 *
 * Group folders are named after their shell (dynamic: nothing here knows any shell name);
 * `shared` is reserved. The check `remote-location` (check-apps.js) enforces the placement.
 */
import path from 'node:path';

/** The folder of a shell app inside its group folder. */
export const SHELL_FOLDER = 'shell';
/** Group folder of remotes listed by two or more shells of a zone (not a valid shell name). */
export const SHARED_GROUP = 'shared';

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
