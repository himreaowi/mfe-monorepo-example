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
  /**
   * URL path of the remote in the shell: the shell's base path + the remotes.json path
   * (`/citizen/announcements`; `/announcements` for a shell at `/`).
   */
  path: string;
  /** The remotes.json `path` (`/announcements`), relative to the shell's router. */
  registryPath: string;
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
  /** Shell name: its group folder (`apps/<zone>/<name>/shell`), e.g. `citizen`. */
  name: string;
  /** The shell's own dev server port (package.json `mfe.port`). */
  port: number;
  /** The zone's dev proxy port (3100 / 3200): the suite tests the shell through it. */
  proxyPort: number;
  /** `http://localhost:<proxy port>`: the Playwright `baseURL`. */
  origin: string;
  /** The shell's base path (package.json `mfe.basePath`): `/` or e.g. `/citizen`. */
  basePath: string;
  /** Path of the shell's home page: `/` or `/citizen/`. Use it instead of `'/'` in specs. */
  home: string;
  /** `<origin><home>`, e.g. `http://localhost:3200/citizen/`. */
  shellUrl: string;
  /** The dev manifest uses the mock sign-in (`"auth": { "mock": true }`). */
  authMock: boolean;
  /** `settings.apiBaseUrl` of the dev manifest, if any. */
  apiBaseUrl?: string;
  /** `apiBaseUrl` is the dev proxy's same-origin `<base>/api` (default upstream: the dev-only mock API, tools/mock-api) or the mock API itself. */
  mockApi: boolean;
  remotes: ZoneRemote[];
  /**
   * URLs the suite waits for besides the shell: remote mf-manifests, local vendor bundles and
   * `<apiBaseUrl>/health` when the API is local (the mock API).
   */
  waitFor: string[];
}

/** Dev proxy port + tools range per zone (mirrors `ZONES` in tools/scripts/src/zones.js). */
export declare const ZONE_PORTS: {
  readonly intranet: {
    readonly proxy: 3100;
    readonly tools: { readonly first: 3190; readonly last: 3199 };
  };
  readonly internet: {
    readonly proxy: 3200;
    readonly tools: { readonly first: 3290; readonly last: 3299 };
  };
};
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
