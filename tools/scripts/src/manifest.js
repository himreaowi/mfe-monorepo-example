// @ts-check
/**
 * Validate a per-environment mfe-manifest.json before it is deployed (CLI:
 * bin/validate-manifest.js, `pnpm -s validate-manifest <file> [--zone=<zone>]`).
 *
 * - the schema (`@org/mf-runtime` mfe-manifest.schema.json, via the precompiled validator the
 *   shells use at runtime, so CI and the browser agree)
 * - with --zone: every remote in the zone shell's remotes.json has an entry (otherwise its route
 *   shows "unavailable"); unknown remotes are warnings
 * - production rules: no `"auth": { "mock": true }`, https entries (http only for localhost)
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

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
 * @param {{ root: string, file: string, zone?: string, allowMock?: boolean }} options
 * @returns {Promise<{ errors: ManifestIssue[], warnings: ManifestIssue[] }>}
 */
export async function validateManifestFile({
  root,
  file,
  zone,
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
  for (const [name, remote] of Object.entries(manifest.remotes ?? {})) {
    const entry = /** @type {{ entry: string }} */ (remote).entry;
    if (entry.startsWith('http://') && !isLocal(entry)) {
      errors.push({
        rule: 'https',
        message: `remotes.${name}.entry: ${entry} must use https.`,
      });
    }
  }

  if (zone) {
    const registryFile = path.join(
      root,
      'apps',
      zone,
      `shell-${zone}`,
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
            message: `remotes.${name} is missing: the ${zone} shell has a route for it (remotes.json), which would show "unavailable".`,
          });
        }
      }
      for (const name of listed) {
        if (!registered.has(name)) {
          warnings.push({
            rule: 'remote-unknown',
            message: `remotes.${name} is not in apps/${zone}/shell-${zone}/remotes.json: no route uses it.`,
          });
        }
      }
    }
  }
  return { errors, warnings };
}
