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

/** "staff-directory" → "Staff Directory" */
export function titleCase(/** @type {string} */ name) {
  return name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** Names derived for the zone's shell. */
export function shellNames(/** @type {Zone} */ zone) {
  return {
    zone,
    dirName: `shell-${zone}`,
    packageName: `${SCOPE}/shell-${zone}`,
    federationName: `${zone}_shell`,
    title: `${titleCase(zone)} Shell`,
  };
}

/** Names derived for a remote. */
export function remoteNames(
  /** @type {Zone} */ zone,
  /** @type {string} */ name,
) {
  return {
    zone,
    name,
    dirName: name,
    packageName: `${SCOPE}/${zone}-${name}`,
    federationName: `${zone}_${name.replaceAll('-', '_')}`,
    title: titleCase(name),
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
