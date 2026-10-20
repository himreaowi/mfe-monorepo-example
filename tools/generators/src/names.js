// @ts-check
/** Naming rules shared by the generators (and re-used by tests). */

/** @typedef {import('@org/scripts/zones').Zone} Zone */

import { ZONES } from '@org/scripts/zones';

export { ZONES };

/** npm scope of every generated package. */
export const SCOPE = '@org';

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
 * Validate a shell name (kebab-case: folder `shell-<name>`, package `@org/shell-<name>`).
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
}

/**
 * Names derived for a shell. `name` defaults to the zone (`shell-intranet`, federation name
 * `intranet_shell`, the zone's only shell); other shells are `shell-<name>` with federation
 * name `<zone>_shell_<name>`.
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
    dirName: `shell-${name}`,
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

/** Error caused by bad input: the CLI prints the message without a stack trace. */
export class UsageError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'UsageError';
  }
}
