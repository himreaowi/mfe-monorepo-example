import validateSchema, {
  type SchemaError,
} from './validateSchema.generated.js';

/** One remote in `mfe-manifest.json`. */
export type MfeRemoteConfig = {
  /** URL of the remote's `mf-manifest.json` (or `remoteEntry.js`). Absolute or root-relative. */
  entry: string;
  /** Extra props passed to the remote's exposed component. */
  props?: Record<string, unknown>;
};

/** `/mfe-manifest.json`, validated against `mfe-manifest.schema.json`. */
export type MfeManifest = {
  $schema?: string;
  /** Keyed by Module Federation name. */
  remotes: Record<string, MfeRemoteConfig>;
  /** Auth (BFF) settings, defined by @org/auth (A6). */
  auth?: Record<string, unknown>;
  /** Runtime settings passed to every remote as host prop `settings`. */
  settings?: Record<string, unknown>;
};

export const DEFAULT_MANIFEST_URL = '/mfe-manifest.json';

/** Thrown when the manifest cannot be fetched, parsed or validated. `issues` lists each problem. */
export class MfeManifestError extends Error {
  readonly issues: string[];
  readonly url?: string;

  constructor(summary: string, issues: string[] = [], url?: string) {
    const where = url ? ` (${url})` : '';
    const details = issues.length
      ? `\n${issues.map((i) => `  - ${i}`).join('\n')}`
      : '';
    super(`Invalid MFE manifest${where}: ${summary}${details}`);
    this.name = 'MfeManifestError';
    this.issues = issues;
    this.url = url;
  }
}

function pointerToPath(pointer: string): string {
  if (!pointer) return '(root)';
  return pointer
    .slice(1)
    .split('/')
    .map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'))
    .join('.');
}

function describe(error: SchemaError): string {
  const at = pointerToPath(error.instancePath);
  const params = error.params as Record<string, string>;
  switch (error.keyword) {
    case 'required':
      return `${at}: missing required property "${params.missingProperty}"`;
    case 'additionalProperty':
    case 'additionalProperties':
      return `${at}: unknown property "${params.additionalProperty}"`;
    case 'propertyNames':
      return `${at}: invalid remote name "${params.propertyName}" (must be a JS identifier, the remote's federation name)`;
    case 'pattern':
      if (error.instancePath.endsWith('/entry')) {
        return `${at}: must be an http(s) URL or root-relative path to the remote's mf-manifest.json or remoteEntry.js`;
      }
      return `${at}: must match ${params.pattern}`;
    case 'type':
      return `${at}: must be ${params.type}`;
    default:
      return `${at}: ${error.message ?? error.keyword}`;
  }
}

export type MfeManifestValidation =
  { ok: true; manifest: MfeManifest } | { ok: false; issues: string[] };

/** Validate parsed JSON against mfe-manifest.schema.json. Never throws. */
export function validateMfeManifest(value: unknown): MfeManifestValidation {
  if (validateSchema(value)) {
    return { ok: true, manifest: value as MfeManifest };
  }
  const errors = validateSchema.errors ?? [];
  // `propertyNames` reports a nested `pattern` error too; keep the clearer one.
  const issues = errors
    .filter(
      (e) =>
        !(
          e.keyword === 'pattern' &&
          errors.some(
            (o) =>
              o.keyword === 'propertyNames' &&
              o.instancePath === e.instancePath,
          )
        ),
    )
    .map(describe);
  return { ok: false, issues: [...new Set(issues)] };
}

/** Validate and return the manifest, or throw MfeManifestError listing every problem. */
export function parseMfeManifest(value: unknown, url?: string): MfeManifest {
  const result = validateMfeManifest(value);
  if (!result.ok) {
    throw new MfeManifestError(
      'does not match mfe-manifest.schema.json',
      result.issues,
      url,
    );
  }
  return result.manifest;
}

export type LoadMfeManifestOptions = {
  /** Default `/mfe-manifest.json`. */
  url?: string;
  fetch?: typeof fetch;
  signal?: AbortSignal;
};

/**
 * Fetch and validate the shell's runtime manifest (`/mfe-manifest.json` by default).
 * Always revalidated with the server (`cache: 'no-cache'`): DevOps can change it without a rebuild.
 */
export async function loadMfeManifest(
  options: LoadMfeManifestOptions = {},
): Promise<MfeManifest> {
  const { url = DEFAULT_MANIFEST_URL, signal } = options;
  const doFetch = options.fetch ?? fetch;
  let response: Response;
  try {
    response = await doFetch(url, {
      cache: 'no-cache',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      signal,
    });
  } catch (error) {
    throw new MfeManifestError(
      `request failed (${error instanceof Error ? error.message : String(error)})`,
      [],
      url,
    );
  }
  if (!response.ok) {
    throw new MfeManifestError(
      `HTTP ${response.status} ${response.statusText}`.trim(),
      [],
      url,
    );
  }
  const text = await response.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new MfeManifestError(
      `not valid JSON (starts with: ${text.slice(0, 60).replace(/\s+/g, ' ')})`,
      [],
      url,
    );
  }
  return parseMfeManifest(json, url);
}

/**
 * Absolute entry URL for a remote. Root-relative entries resolve against `base`
 * (default: the page origin).
 */
export function resolveRemoteEntry(entry: string, base?: string): string {
  const origin =
    base ??
    (typeof window !== 'undefined'
      ? window.location.href
      : 'http://localhost/');
  return new URL(entry, origin).toString();
}
