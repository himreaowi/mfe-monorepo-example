/**
 * Where and how to load an external module. Lives in the host's runtime manifest (per
 * environment), e.g. the adapter remote's `props.vendor` in mfe-manifest.json. Never baked into
 * a build.
 */
export type ExternalModuleFormat = 'esm' | 'script' | 'web-component' | 'mf';

export type ExternalModuleConfig = {
  /** Bundle URL: absolute http(s) URL or root-relative path. For `mf`: the remote's mf-manifest.json / remoteEntry.js. */
  url: string;
  format: ExternalModuleFormat;
  /** `esm`: named export holding `{ contractVersion, mount }`. Default: the module itself (or its default export). */
  exportName?: string;
  /** `script`: the global the script sets (required). */
  global?: string;
  /** `web-component`: the custom element name (required). */
  tagName?: string;
  /** `web-component`: load the script as `module` (default) or `classic`. */
  scriptType?: 'module' | 'classic';
  /** `mf`: the vendor remote's federation name (required). */
  remoteName?: string;
  /** `mf`: exposed module. Default `./mount`. */
  expose?: string;
  /** Subresource Integrity hash (`sha384-…`) of the bundle. Supported for esm, script, web-component. */
  integrity?: string;
  /** CORS mode for the bundle request. Default `anonymous`. */
  crossOrigin?: 'anonymous' | 'use-credentials';
  /** Load + mount timeout in ms. Default 15000. */
  timeoutMs?: number;
  /** Module-specific configuration, passed to the module as `props.config`. */
  config?: Record<string, unknown>;
};

export type ExternalModuleConfigValidation =
  { ok: true; config: ExternalModuleConfig } | { ok: false; issues: string[] };

const FORMATS: ExternalModuleFormat[] = [
  'esm',
  'script',
  'web-component',
  'mf',
];
const URL_PATTERN = /^(https?:\/\/[^\s/]+)?\/\S*$/;
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*)*$/;
const FEDERATION_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
// custom element names: lowercase, start with a letter, contain a hyphen
const TAG_NAME = /^[a-z][a-z0-9._]*-[a-z0-9._-]*$/;
const SRI =
  /^(sha256|sha384|sha512)-[A-Za-z0-9+/]+={0,2}( (sha256|sha384|sha512)-[A-Za-z0-9+/]+={0,2})*$/;
const KNOWN = new Set([
  'url',
  'format',
  'exportName',
  'global',
  'tagName',
  'scriptType',
  'remoteName',
  'expose',
  'integrity',
  'crossOrigin',
  'timeoutMs',
  'config',
]);

/** Validate an external module config (e.g. from manifest props). Never throws. */
export function validateExternalModuleConfig(
  value: unknown,
): ExternalModuleConfigValidation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      ok: false,
      issues: [
        'must be an object like { "url": "https://…/mount.js", "format": "esm" }',
      ],
    };
  }
  const c = value as Record<string, unknown>;
  const issues: string[] = [];
  for (const key of Object.keys(c)) {
    if (!KNOWN.has(key)) issues.push(`unknown property "${key}"`);
  }
  if (typeof c.url !== 'string' || !URL_PATTERN.test(c.url)) {
    issues.push('url: must be an http(s) URL or a root-relative path');
  }
  if (!FORMATS.includes(c.format as ExternalModuleFormat)) {
    issues.push(`format: must be one of ${FORMATS.join(', ')}`);
  }
  const optionalString = (key: string, pattern: RegExp, hint: string) => {
    if (
      c[key] !== undefined &&
      (typeof c[key] !== 'string' || !pattern.test(c[key] as string))
    ) {
      issues.push(`${key}: ${hint}`);
    }
  };
  optionalString('exportName', IDENTIFIER, 'must be an identifier');
  optionalString('global', IDENTIFIER, 'must be an identifier (dots allowed)');
  optionalString(
    'tagName',
    TAG_NAME,
    'must be a custom element name (lowercase, with a "-")',
  );
  optionalString(
    'remoteName',
    FEDERATION_NAME,
    'must be a JS identifier (the federation name)',
  );
  optionalString(
    'expose',
    /^\.\/[A-Za-z0-9_./-]+$/,
    'must look like "./mount"',
  );
  optionalString('integrity', SRI, 'must be an SRI hash like "sha384-…"');
  if (
    c.scriptType !== undefined &&
    c.scriptType !== 'module' &&
    c.scriptType !== 'classic'
  ) {
    issues.push('scriptType: must be "module" or "classic"');
  }
  if (
    c.crossOrigin !== undefined &&
    c.crossOrigin !== 'anonymous' &&
    c.crossOrigin !== 'use-credentials'
  ) {
    issues.push('crossOrigin: must be "anonymous" or "use-credentials"');
  }
  if (
    c.timeoutMs !== undefined &&
    (typeof c.timeoutMs !== 'number' ||
      !Number.isInteger(c.timeoutMs) ||
      c.timeoutMs < 1000 ||
      c.timeoutMs > 120000)
  ) {
    issues.push('timeoutMs: must be an integer between 1000 and 120000');
  }
  if (
    c.config !== undefined &&
    (typeof c.config !== 'object' ||
      c.config === null ||
      Array.isArray(c.config))
  ) {
    issues.push('config: must be an object');
  }
  if (c.format === 'script' && c.global === undefined)
    issues.push('global: required for format "script"');
  if (c.format === 'web-component' && c.tagName === undefined) {
    issues.push('tagName: required for format "web-component"');
  }
  if (c.format === 'mf') {
    if (c.remoteName === undefined)
      issues.push('remoteName: required for format "mf"');
    if (c.integrity !== undefined)
      issues.push('integrity: not supported for format "mf"');
  }
  return issues.length
    ? { ok: false, issues }
    : { ok: true, config: c as ExternalModuleConfig };
}
