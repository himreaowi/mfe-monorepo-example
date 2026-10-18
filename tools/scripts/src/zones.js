// @ts-check
/**
 * Zones and their dev-port ranges (single source for generators, checks, tools and e2e).
 * Apps: the shell takes the first port of its zone, remotes get the next free ones up to `last`.
 * `tools`: reserved for the zone's dev-only tool servers (mock API, mock vendor, …), so
 * `pnpm dev:intranet` and `pnpm dev:internet` can run at the same time.
 */
export const ZONES = /** @type {const} */ ({
  intranet: { first: 3100, last: 3189, tools: { first: 3190, last: 3199 } },
  internet: { first: 3200, last: 3289, tools: { first: 3290, last: 3299 } },
});

/** @typedef {keyof typeof ZONES} Zone */

/**
 * Offset of each dev tool server inside its zone's tools range. Example addition:
 * `exampleVendors` (tools/example-vendors: intranet 3192, internet 3292).
 */
const TOOL_OFFSETS = /** @type {const} */ ({
  mockApi: 0,
  mockVendor: 1,
  exampleVendors: 2,
});

/** @typedef {keyof typeof TOOL_OFFSETS} ToolName */

/**
 * Dev port of a tool server in a zone (intranet: mock API 3190, mock vendor 3191; internet:
 * 3290, 3291).
 * @param {Zone} zone
 * @param {ToolName} tool
 * @returns {number}
 */
export function toolPort(zone, tool) {
  const range = ZONES[zone];
  if (!range) throw new Error(`Unknown zone "${String(zone)}"`);
  return range.tools.first + TOOL_OFFSETS[tool];
}

/** Every tool port of every zone (e.g. to recognise the mock vendor in e2e). */
export function allToolPorts(/** @type {ToolName} */ tool) {
  return /** @type {Zone[]} */ (Object.keys(ZONES)).map((zone) =>
    toolPort(zone, tool),
  );
}

/** Nx tag values every app must declare (package.json `nx.tags`). */
export const APP_TAGS = /** @type {const} */ ({
  zone: Object.keys(ZONES),
  type: ['shell', 'remote'],
  access: ['public', 'private'],
  kind: ['external'],
});

/** Federation names are JS identifiers. */
export const FEDERATION_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
