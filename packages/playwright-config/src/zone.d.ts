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
  remotes: ZoneRemote[];
  /** URLs the suite waits for besides the shell (remote mf-manifests, local vendor bundles). */
  waitFor: string[];
}

export declare const MOCK_VENDOR_ORIGIN: string;
export declare function isMockVendor(vendor: unknown): boolean;
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
