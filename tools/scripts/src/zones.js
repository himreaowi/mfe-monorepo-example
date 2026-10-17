// @ts-check
/**
 * Zones and their dev-port ranges (single source for generators and checks).
 * The shell takes the first port of its zone; remotes get the next free ones.
 */
export const ZONES = /** @type {const} */ ({
  intranet: { first: 3100, last: 3199 },
  internet: { first: 3200, last: 3299 },
});

/** @typedef {keyof typeof ZONES} Zone */

/** Nx tag values every app must declare (package.json `nx.tags`). */
export const APP_TAGS = /** @type {const} */ ({
  zone: Object.keys(ZONES),
  type: ['shell', 'remote'],
  access: ['public', 'private'],
  kind: ['external'],
});

/** Federation names are JS identifiers. */
export const FEDERATION_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
