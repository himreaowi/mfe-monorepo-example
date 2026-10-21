// @ts-check
/**
 * Validate a per-environment mfe-manifest.json before it is deployed (CLI:
 * bin/validate-manifest.js, `pnpm -s validate-manifest <file> [--zone=<zone>] [--shell=<name>]`).
 *
 * - the schema (`@org/mf-runtime` mfe-manifest.schema.json, via the precompiled validator the
 *   shells use at runtime, so CI and the browser agree)
 * - with --zone: every remote in the shell's remotes.json has an entry (otherwise its route
 *   shows "unavailable"); unknown remotes are warnings. The shell: `--shell=<name>`
 *   (apps/<zone>/<name>/shell), required when the zone has several shells (each has its own
 *   manifest)
 * - production rules: no `"auth": { "mock": true }`, https entries (http only for localhost)
 * - warnings for absolute API / sign-in URLs: the browser should only call its own origin
 *   (`<base>/api`, `<base>/auth/...`, proxied by nginx to API_UPSTREAM / AUTH_UPSTREAM)
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SHARED_GROUP, SHELL_FOLDER } from './layout.js';

/** @typedef {{ rule: string, message: string }} ManifestIssue */

const VALIDATOR =
  'packages/mf-runtime/src/manifest/validateSchema.generated.js';

/** @param {string} pointer */
const at = (pointer) =>
  pointer === ''
    ? '(root)'
    : pointer
        .slice(1)
        .split('/')
        .map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'))
        .join('.');

/** @param {string} url */
function isLocal(url) {
  try {
    return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * @param {{ root: string, file: string, zone?: string, shell?: string, allowMock?: boolean }} options
 * @returns {Promise<{ errors: ManifestIssue[], warnings: ManifestIssue[] }>}
 */
export async function validateManifestFile({
  root,
  file,
  zone,
  shell,
  allowMock = false,
}) {
  /** @type {ManifestIssue[]} */
  const errors = [];
  /** @type {ManifestIssue[]} */
  const warnings = [];
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    errors.push({
      rule: 'json',
      message: `${file}: ${/** @type {Error} */ (error).message}`,
    });
    return { errors, warnings };
  }

  const { validate } = await import(
    pathToFileURL(path.join(root, VALIDATOR)).href
  );
  if (!validate(manifest)) {
    for (const e of validate.errors ?? []) {
      if (e.keyword === 'if') continue;
      const extra =
        e.params?.additionalProperty ?? e.params?.missingProperty ?? '';
      errors.push({
        rule: 'schema',
        message: `${at(e.instancePath)}: ${e.message ?? e.keyword}${extra ? ` (${extra})` : ''}`,
      });
    }
    return { errors, warnings };
  }

  if (manifest.auth?.mock === true && !allowMock) {
    errors.push({
      rule: 'auth-mock',
      message:
        '"auth": { "mock": true } is for development only (production builds ignore it and disable sign-in). Use the BFF URLs (docs/auth-contract.md).',
    });
  }
  const sameOrigin = /** @type {[string, unknown][]} */ ([
    ['settings.apiBaseUrl', manifest.settings?.apiBaseUrl],
    ['auth.sessionUrl', manifest.auth?.sessionUrl],
    ['auth.loginUrl', manifest.auth?.loginUrl],
    ['auth.logoutUrl', manifest.auth?.logoutUrl],
  ]);
  for (const [key, value] of sameOrigin) {
    if (typeof value === 'string' && /^https?:\/\//.test(value)) {
      warnings.push({
        rule: 'same-origin',
        message: `${key}: ${value} is an absolute URL, so the browser calls another origin (CORS, a host in the CSP). Use the shell's same-origin proxy path (<base path>/api, <base path>/auth/...) and set API_UPSTREAM / AUTH_UPSTREAM instead (docs/configuration.md).`,
      });
    }
  }
  for (const [name, remote] of Object.entries(manifest.remotes ?? {})) {
    const entry = /** @type {{ entry: string }} */ (remote).entry;
    if (entry.startsWith('http://') && !isLocal(entry)) {
      errors.push({
        rule: 'https',
        message: `remotes.${name}.entry: ${entry} must use https.`,
      });
    }
  }

  /** the zone's shells: group folders apps/<zone>/<name> that contain a shell/ folder */
  const zoneDir = path.join(root, 'apps', zone ?? '');
  const shells =
    zone && fs.existsSync(zoneDir)
      ? fs
          .readdirSync(zoneDir, { withFileTypes: true })
          .filter(
            (d) =>
              d.isDirectory() &&
              d.name !== SHARED_GROUP &&
              fs.existsSync(
                path.join(zoneDir, d.name, SHELL_FOLDER, 'package.json'),
              ),
          )
          .map((d) => d.name)
          .sort()
      : [];
  const shellName = shell ?? (shells.length === 1 ? shells[0] : zone);
  if (zone && !shell && shells.length > 1) {
    errors.push({
      rule: 'zone',
      message: `The ${zone} zone has ${shells.length} shells (${shells.join(', ')}), each with its own manifest: pass --shell=<name>.`,
    });
  } else if (zone) {
    const registryFile = path.join(
      root,
      'apps',
      zone,
      String(shellName),
      SHELL_FOLDER,
      'remotes.json',
    );
    if (!fs.existsSync(registryFile)) {
      errors.push({
        rule: 'zone',
        message: `${path.relative(root, registryFile)} not found (is "${zone}" a zone with a shell?).`,
      });
    } else {
      const registry = JSON.parse(fs.readFileSync(registryFile, 'utf8'));
      const registered = new Set(
        (registry.remotes ?? []).map(
          (/** @type {{ federationName: string }} */ r) => r.federationName,
        ),
      );
      const listed = new Set(Object.keys(manifest.remotes ?? {}));
      for (const name of registered) {
        if (!listed.has(name)) {
          errors.push({
            rule: 'remote-missing',
            message: `remotes.${name} is missing: the ${shellName} shell has a route for it (remotes.json), which would show "unavailable".`,
          });
        }
      }
      for (const name of listed) {
        if (!registered.has(name)) {
          warnings.push({
            rule: 'remote-unknown',
            message: `remotes.${name} is not in apps/${zone}/${shellName}/${SHELL_FOLDER}/remotes.json: no route uses it.`,
          });
        }
      }
    }
  }
  return { errors, warnings };
}
