/** One entry of the shell's remotes.json. */
export interface RegistryEntry {
  name: string;
  title: string;
  /** Mount path in the shell, e.g. `/staff-directory`. */
  path: string;
  federationName: string;
  package: string;
  access: 'public' | 'private';
  kind: 'react' | 'external';
}

/** A registry entry plus where its dev server runs (from mfe-manifest.dev.json). */
export interface ZoneRemote extends RegistryEntry {
  /** `http://localhost:<port>/mf-manifest.json` */
  entry: string;
  /** `http://localhost:<port>` */
  origin: string;
  /** The remote's own dev server root (standalone mode). */
  standaloneUrl: string;
  /** `props.vendor` of an external adapter, if any. */
  vendor?: unknown;
  /** The vendor config points at the dev-only mock vendor (tools/mock-vendor). */
  mockVendor: boolean;
}

export interface Zone {
  zone: string;
  shellDir: string;
  packageName: string;
  port: number;
  /** `http://localhost:<shell port>` */
  shellUrl: string;
  /** The dev manifest uses the mock sign-in (`"auth": { "mock": true }`). */
  authMock: boolean;
  /** `settings.apiBaseUrl` of the dev manifest, if any. */
  apiBaseUrl?: string;
  /** `apiBaseUrl` points at the dev-only mock API (tools/mock-api) of a zone. */
  mockApi: boolean;
  remotes: ZoneRemote[];
  /**
   * URLs the suite waits for besides the shell: remote mf-manifests, local vendor bundles and
   * `<apiBaseUrl>/health` when the API is local (the mock API).
   */
  waitFor: string[];
}

/** Tools port range per zone (mirrors `ZONES[zone].tools` in tools/scripts/src/zones.js). */
export declare const ZONE_TOOL_RANGES: {
  readonly intranet: { readonly first: 3190; readonly last: 3199 };
  readonly internet: { readonly first: 3290; readonly last: 3299 };
};
/**
 * Dev ports of the zone tool servers per tool name (`[intranet, internet]`), from the root
 * package.json `mfe.tools` (same source as `toolPort()` in tools/scripts).
 */
export declare const TOOL_PORTS: Readonly<Record<string, readonly number[]>>;
/** Tool ports declared in `<root>/package.json` `mfe.tools`. */
export declare function readToolPorts(root: string): Record<string, number[]>;
/** Mock vendor origins of every zone (`http://localhost:3191`, `http://localhost:3291`). */
export declare const MOCK_VENDOR_ORIGINS: string[];
/** Mock API origins of every zone (`http://localhost:3190`, `http://localhost:3290`). */
export declare const MOCK_API_ORIGINS: string[];
export declare function isMockVendor(vendor: unknown): boolean;
/** `<apiBaseUrl>/health` for a localhost API base URL, else `undefined`. */
export declare function localHealthUrl(apiBaseUrl: unknown): string | undefined;
export declare function loadZone(shellDir: string): Zone;
export declare function findWorkspaceRoot(dir: string): string;
export declare function waitForUrls(
  urls: string[],
  options?: {
    timeoutMs?: number;
    intervalMs?: number;
    fetch?: typeof fetch;
    hint?: string;
  },
): Promise<void>;
