// @ts-check
import fs from 'node:fs';
import path from 'node:path';

/**
 * Zones and their dev-port ranges (single source for generators, checks, tools and e2e).
 * Apps: the shell takes the first port of its zone, remotes get the next free ones up to `last`.
 * `tools`: reserved for the zone's dev-only tool servers (mock API, mock vendor, …), so
 * `pnpm dev:intranet` and `pnpm dev:internet` can run at the same time. Which tool takes which
 * port of that range is declared in the root package.json (`mfe.tools`), not here.
 */
export const ZONES = /** @type {const} */ ({
  intranet: { first: 3100, last: 3189, tools: { first: 3190, last: 3199 } },
  internet: { first: 3200, last: 3289, tools: { first: 3290, last: 3299 } },
});

/** @typedef {keyof typeof ZONES} Zone */

/** The workspace this file belongs to (tools/scripts/src → repo root). */
export const WORKSPACE_ROOT = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
);

/**
 * A dev tool server declared in the root package.json:
 *   "mfe": { "tools": { "<toolName>": { "offset": <0-9>, "package": "@org/<tool package>" } } }
 * Its port in a zone is `tools.first + offset` (intranet 3190 + offset, internet 3290 + offset).
 * @typedef {{ offset: number, package?: string }} ToolConfig
 */

/** Number of ports every zone reserves for tools (the smallest tools range wins). */
export const TOOL_SLOTS = Math.min(
  ...Object.values(ZONES).map((z) => z.tools.last - z.tools.first + 1),
);

/** Tool names are JS identifiers (camelCase by convention: mockApi, mockVendor). */
export const TOOL_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** @type {Map<string, Record<string, unknown>>} */
const toolCache = new Map();

/**
 * The raw `mfe.tools` object of a workspace's root package.json (not validated: `pnpm check`
 * does that, see check-apps). Read once per root.
 * @param {string} [root]
 * @returns {Record<string, unknown>}
 */
export function readToolConfig(root = WORKSPACE_ROOT) {
  const cached = toolCache.get(root);
  if (cached) return cached;
  const file = path.join(root, 'package.json');
  /** @type {Record<string, unknown>} */
  let tools = {};
  if (fs.existsSync(file)) {
    const value = JSON.parse(fs.readFileSync(file, 'utf8')).mfe?.tools;
    if (value !== undefined && value !== null) {
      tools = /** @type {Record<string, unknown>} */ (value);
    }
  }
  toolCache.set(root, tools);
  return tools;
}

/**
 * Dev port of a tool server in a zone, from the root package.json `mfe.tools` (template:
 * mockApi offset 0, mockVendor offset 1 → intranet 3190 / 3191, internet 3290 / 3291).
 * @param {Zone} zone
 * @param {string} tool name in `mfe.tools`
 * @param {string} [root] workspace root (default: this repo)
 * @returns {number}
 */
export function toolPort(zone, tool, root = WORKSPACE_ROOT) {
  const range = ZONES[zone];
  if (!range) throw new Error(`Unknown zone "${String(zone)}"`);
  const tools = readToolConfig(root);
  const config = Object.hasOwn(tools, tool) ? tools[tool] : undefined;
  if (config === undefined) {
    throw new Error(
      `Unknown dev tool "${tool}": declare it in ${path.join(root, 'package.json')} under "mfe": { "tools": { "${tool}": { "offset": <0-${TOOL_SLOTS - 1}>, "package": "<package>" } } } (docs/architecture.md, "Adding a dev-tool server").`,
    );
  }
  const offset = /** @type {{ offset?: unknown }} */ (config)?.offset;
  if (
    typeof offset !== 'number' ||
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset >= TOOL_SLOTS
  ) {
    throw new Error(
      `Dev tool "${tool}": "offset" must be an integer 0-${TOOL_SLOTS - 1} (root package.json mfe.tools). Run pnpm check.`,
    );
  }
  return range.tools.first + offset;
}

/**
 * Every tool port of every zone (e.g. to recognise the mock vendor in e2e).
 * @param {string} tool
 * @param {string} [root]
 */
export function allToolPorts(tool, root = WORKSPACE_ROOT) {
  return /** @type {Zone[]} */ (Object.keys(ZONES)).map((zone) =>
    toolPort(zone, tool, root),
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
