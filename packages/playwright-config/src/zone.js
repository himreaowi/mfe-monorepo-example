// @ts-check
/**
 * Reads a zone from its shell folder: the shell's port (package.json `mfe`), its registry
 * (remotes.json) and its dev manifest (mfe-manifest.dev.json). No Playwright imports, so the
 * config factory, the global setup, the specs and node tests can all use it.
 */
import fs from 'node:fs';
import path from 'node:path';
/**
 * Dev ports of the zone tool servers, per zone (intranet, internet). Mirrors `toolPort()` in
 * tools/scripts/src/zones.js (packages cannot import tools; a tools/scripts test keeps the two
 * in sync).
 */
export const TOOL_PORTS = /** @type {const} */ ({
  mockApi: [3190, 3290],
  mockVendor: [3191, 3291],
});

/** Origins of the dev-only mock vendor (tools/mock-vendor), one per zone. */
export const MOCK_VENDOR_ORIGINS = TOOL_PORTS.mockVendor.map(
  (port) => `http://localhost:${port}`,
);

/** Origins of the dev-only mock API (tools/mock-api), one per zone. */
export const MOCK_API_ORIGINS = TOOL_PORTS.mockApi.map(
  (port) => `http://localhost:${port}`,
);

/**
 * @param {string} file
 * @returns {any}
 */
function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(
      `@org/playwright-config: cannot read ${file}: ${/** @type {Error} */ (error).message}`,
      { cause: error },
    );
  }
}

/**
 * @param {unknown} vendor
 * @returns {vendor is { url: string }}
 */
function hasUrl(vendor) {
  return (
    typeof vendor === 'object' &&
    vendor !== null &&
    typeof (/** @type {{ url?: unknown }} */ (vendor).url) === 'string'
  );
}

/** True when a vendor config points at the dev-only mock vendor (of any zone). */
export function isMockVendor(/** @type {unknown} */ vendor) {
  return (
    hasUrl(vendor) &&
    MOCK_VENDOR_ORIGINS.some((origin) => vendor.url.startsWith(`${origin}/`))
  );
}

/**
 * Health URL of a local API base URL (`http://localhost:3190/api` → `…/api/health`), or
 * `undefined` for remote APIs (the suite does not wait for servers it does not start).
 * @param {unknown} apiBaseUrl
 */
export function localHealthUrl(apiBaseUrl) {
  if (typeof apiBaseUrl !== 'string' || !isLocal(apiBaseUrl)) return undefined;
  return `${apiBaseUrl.replace(/\/+$/, '')}/health`;
}

/** @param {string} url */
function isLocal(url) {
  try {
    const { hostname } = new URL(url);
    return ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
  } catch {
    return false;
  }
}

/**
 * @param {string} shellDir absolute path of apps/<zone>/shell-<zone>
 * @returns {import('./zone.d.ts').Zone}
 */
export function loadZone(shellDir) {
  const pkg = readJson(path.join(shellDir, 'package.json'));
  const tags = /** @type {string[]} */ (pkg.nx?.tags ?? []);
  const zone = tags.find((t) => t.startsWith('zone:'))?.slice('zone:'.length);
  if (!zone) {
    throw new Error(
      `@org/playwright-config: ${shellDir}/package.json has no "zone:<zone>" tag in nx.tags.`,
    );
  }
  const port = pkg.mfe?.port;
  if (!Number.isInteger(port)) {
    throw new Error(
      `@org/playwright-config: ${shellDir}/package.json has no "mfe.port".`,
    );
  }
  const registry = readJson(path.join(shellDir, 'remotes.json'));
  const manifest = readJson(path.join(shellDir, 'mfe-manifest.dev.json'));
  /** @type {import('./zone.d.ts').ZoneRemote[]} */
  const remotes = (registry.remotes ?? []).map(
    (/** @type {import('./zone.d.ts').RegistryEntry} */ entry) => {
      const dev = manifest.remotes?.[entry.federationName];
      if (!dev?.entry) {
        throw new Error(
          `@org/playwright-config: remote ${entry.federationName} (remotes.json) has no entry in mfe-manifest.dev.json.`,
        );
      }
      const origin = new URL(dev.entry).origin;
      const vendor = dev.props?.vendor;
      return {
        ...entry,
        entry: dev.entry,
        origin,
        standaloneUrl: `${origin}/`,
        vendor,
        mockVendor: isMockVendor(vendor),
      };
    },
  );
  const vendorUrls = remotes
    .map((r) => r.vendor)
    .filter(hasUrl)
    .map((v) => v.url)
    .filter(isLocal);
  const apiBaseUrl =
    typeof manifest.settings?.apiBaseUrl === 'string'
      ? manifest.settings.apiBaseUrl
      : undefined;
  const apiHealthUrl = localHealthUrl(apiBaseUrl);
  return {
    zone,
    shellDir,
    packageName: pkg.name,
    port,
    shellUrl: `http://localhost:${port}`,
    authMock: manifest.auth?.mock === true,
    apiBaseUrl,
    mockApi:
      apiBaseUrl !== undefined &&
      MOCK_API_ORIGINS.some((origin) => apiBaseUrl.startsWith(`${origin}/`)),
    remotes,
    // everything the suite needs besides the shell: remote dev servers, local vendors and the
    // local API's health URL (settings.apiBaseUrl, e.g. the mock API)
    waitFor: [
      ...new Set([
        ...remotes.map((r) => r.entry),
        ...vendorUrls,
        ...(apiHealthUrl ? [apiHealthUrl] : []),
      ]),
    ],
  };
}

/**
 * Nearest parent folder with a pnpm-workspace.yaml.
 * @param {string} dir
 */
export function findWorkspaceRoot(dir) {
  let current = path.resolve(dir);
  for (;;) {
    if (fs.existsSync(path.join(current, 'pnpm-workspace.yaml'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(
        `@org/playwright-config: no pnpm-workspace.yaml above ${dir}.`,
      );
    }
    current = parent;
  }
}

/**
 * Poll until every URL answers (any HTTP status below 500), or throw after `timeoutMs`.
 * @param {string[]} urls
 * @param {{ timeoutMs?: number, intervalMs?: number, fetch?: typeof fetch, hint?: string }} [options]
 */
export async function waitForUrls(urls, options = {}) {
  const {
    timeoutMs = 180_000,
    intervalMs = 500,
    fetch: doFetch = fetch,
    hint = '',
  } = options;
  const deadline = Date.now() + timeoutMs;
  let pending = [...urls];
  while (pending.length > 0) {
    const results = await Promise.all(
      pending.map(async (url) => {
        try {
          const res = await doFetch(url, {
            signal: AbortSignal.timeout(Math.max(1000, intervalMs * 4)),
          });
          await res.body?.cancel();
          return res.status < 500;
        } catch {
          return false;
        }
      }),
    );
    pending = pending.filter((_, i) => !results[i]);
    if (pending.length === 0) return;
    if (Date.now() >= deadline) {
      throw new Error(
        `Not responding after ${Math.round(timeoutMs / 1000)} s:\n${pending
          .map((u) => `  - ${u}`)
          .join('\n')}${hint ? `\n${hint}` : ''}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
