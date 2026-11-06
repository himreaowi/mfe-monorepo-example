// @ts-check
/** Naming rules shared by the generators (and re-used by tests). */

/** @typedef {import('@org/scripts/zones').Zone} Zone */

import { ZONES } from '@org/scripts/zones';
import {
  LIBS_GROUP,
  RESERVED_GROUPS,
  SCOPE,
  SHARED_GROUP,
  SHELL_FOLDER,
  libraryDir,
  libraryPackageName,
} from '@org/scripts/layout';

export { ZONES, SCOPE };

const REMOTE_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const RESERVED = new Set([
  'shell',
  'app',
  'apps',
  'src',
  'dist',
  'public',
  'node_modules',
  'packages',
  'tools',
  'assets',
  'static',
  'api',
  // folders with a meaning of their own (apps/<zone>/shared, apps/<zone>/libs, packages/common, …)
  ...RESERVED_GROUPS,
  'common',
  'platform',
]);

/**
 * @param {unknown} zone
 * @returns {asserts zone is Zone}
 */
export function assertZone(zone) {
  if (typeof zone !== 'string' || !Object.hasOwn(ZONES, zone)) {
    throw new UsageError(
      `Unknown zone "${String(zone ?? '')}". Use one of: ${Object.keys(ZONES).join(', ')}.`,
    );
  }
}

/**
 * Validate a remote name (kebab-case, used as folder, route segment and package name suffix).
 * @param {unknown} name
 * @returns {asserts name is string}
 */
export function assertRemoteName(name) {
  if (typeof name !== 'string' || name.length === 0) {
    throw new UsageError('Missing remote name (e.g. staff-directory).');
  }
  if (!REMOTE_NAME.test(name)) {
    throw new UsageError(
      `Invalid remote name "${name}". Use kebab-case: lowercase letters and digits separated by single "-", starting with a letter (e.g. staff-directory).`,
    );
  }
  if (name.length < 2 || name.length > 40) {
    throw new UsageError(
      `Invalid remote name "${name}": use 2 to 40 characters.`,
    );
  }
  if (RESERVED.has(name) || name.startsWith('shell-')) {
    throw new UsageError(
      `Invalid remote name "${name}": "${name}" is reserved (shells are created with pnpm gen:shell).`,
    );
  }
}

/**
 * Words written in capitals in generated titles. Extend when your product has more (keep it
 * short: everything else is sentence case, docs/ui-context.md "Content & copy").
 */
export const TITLE_ACRONYMS = new Set([
  'api',
  'faq',
  'hr',
  'id',
  'it',
  'pdf',
  'sms',
  'ui',
  'url',
  'ux',
]);

/**
 * Sentence-case title from a kebab-case name: "staff-directory" → "Staff directory",
 * "it-helpdesk" → "IT helpdesk", "hr-faq" → "HR FAQ".
 * @param {string} name
 */
export function titleFromName(name) {
  return name
    .split('-')
    .filter(Boolean)
    .map((part, index) => {
      if (TITLE_ACRONYMS.has(part)) return part.toUpperCase();
      return index === 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part;
    })
    .join(' ');
}

const TITLE_FORBIDDEN = /['"`\\<>{}$\r\n]/;

/**
 * Validate a `--title` override. It ends up in TS string literals, JSX and Markdown, so quotes,
 * backslashes, braces, angle brackets, `$` and line breaks are refused (use ’ for apostrophes).
 * @param {unknown} title
 * @returns {string} the trimmed title
 */
export function assertTitle(title) {
  if (typeof title !== 'string' || title.trim().length === 0) {
    throw new UsageError(
      '--title needs a non-empty text, e.g. --title "Staff portal".',
    );
  }
  const trimmed = title.trim().replace(/\s+/g, ' ');
  if (trimmed.length > 60) {
    throw new UsageError(
      `--title "${trimmed}" is too long: use 60 characters or fewer.`,
    );
  }
  if (TITLE_FORBIDDEN.test(trimmed)) {
    throw new UsageError(
      `--title "${trimmed}" contains a character the templates cannot hold (' " \` \\ < > { } $). Use ’ for apostrophes.`,
    );
  }
  return trimmed;
}

/**
 * Validate a shell name (kebab-case: group folder `apps/<zone>/<name>/`, package `@org/shell-<name>`; `shared` is reserved).
 * @param {unknown} name
 * @returns {asserts name is string}
 */
export function assertShellName(name) {
  if (
    typeof name !== 'string' ||
    !REMOTE_NAME.test(name) ||
    name.length < 2 ||
    name.length > 30
  ) {
    throw new UsageError(
      `Invalid shell name "${String(name)}". Use kebab-case, 2 to 30 characters (e.g. citizen, business).`,
    );
  }
  if (name === SHARED_GROUP) {
    throw new UsageError(
      `"${SHARED_GROUP}" is reserved: apps/<zone>/${SHARED_GROUP}/ holds the remotes that two or more shells list. Pick another portal name.`,
    );
  }
  if (name === LIBS_GROUP) {
    throw new UsageError(
      `"${LIBS_GROUP}" is reserved: apps/<zone>/${LIBS_GROUP}/ holds the zone's code libraries (pnpm gen:package <zone> <capability>). Pick another portal name.`,
    );
  }
}

/**
 * Names derived for a shell. `name` defaults to the zone (package `@org/shell-intranet`,
 * federation name `intranet_shell`, the zone's only shell); other shells have federation name
 * `<zone>_shell_<name>`. The shell app lives in `apps/<zone>/<name>/shell`.
 * @param {Zone} zone
 * @param {{ name?: string, title?: string }} [opts] `title`: the `--title` override (default
 *   "<Name> shell", e.g. "Intranet shell", "Business shell")
 */
export function shellNames(zone, opts = {}) {
  const name = opts.name ?? zone;
  assertShellName(name);
  return {
    zone,
    name,
    groupName: name,
    dirName: SHELL_FOLDER,
    packageName: `${SCOPE}/shell-${name}`,
    federationName:
      name === zone
        ? `${zone}_shell`
        : `${zone}_shell_${name.replaceAll('-', '_')}`,
    title:
      opts.title !== undefined
        ? assertTitle(opts.title)
        : `${titleFromName(name)} shell`,
  };
}

/**
 * Names derived for a remote.
 * @param {Zone} zone
 * @param {string} name
 * @param {{ title?: string }} [opts] `title`: the `--title` override (default from the name)
 */
export function remoteNames(zone, name, opts = {}) {
  return {
    zone,
    name,
    dirName: name,
    packageName: `${SCOPE}/${zone}-${name}`,
    federationName: `${zone}_${name.replaceAll('-', '_')}`,
    title:
      opts.title !== undefined ? assertTitle(opts.title) : titleFromName(name),
    routePath: `/${name}`,
  };
}

/** Where `pnpm gen:package` puts a library: `common` or a zone. */
export const PACKAGE_TARGETS = /** @type {const} */ ([
  'common',
  ...Object.keys(ZONES),
]);

/**
 * Validate a library capability name (kebab-case: folder and package name suffix).
 * @param {unknown} name
 * @returns {asserts name is string}
 */
export function assertCapabilityName(name) {
  if (typeof name !== 'string' || name.length === 0) {
    throw new UsageError(
      'Missing capability name (e.g. identity, staff-search).',
    );
  }
  if (!REMOTE_NAME.test(name) || name.length < 2 || name.length > 40) {
    throw new UsageError(
      `Invalid capability name "${name}". Use kebab-case, 2 to 40 characters: lowercase letters and digits separated by single "-", starting with a letter (e.g. identity, staff-search).`,
    );
  }
  if (RESERVED.has(name) || Object.hasOwn(ZONES, name)) {
    throw new UsageError(
      `Invalid capability name "${name}": "${name}" is reserved. Name the library after what it does (e.g. identity, addresses).`,
    );
  }
}

/**
 * Names derived for a code library (`pnpm gen:package <common|zone> <capability>`).
 * @param {string} target `common` or a zone
 * @param {string} capability
 */
export function packageNames(target, capability) {
  return {
    target,
    capability,
    dir: libraryDir(target, capability),
    packageName: libraryPackageName(target, capability),
    title: titleFromName(capability),
  };
}

/** Error caused by bad input: the CLI prints the message without a stack trace. */
export class UsageError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'UsageError';
  }
}
