// @ts-check
/**
 * Build step of deploy/Dockerfile: writes /etc/nginx/mfe-shell.env for the entrypoint script
 * (docker-entrypoint.d/40-mfe-manifest.sh), from the app's own files:
 *
 *   MFE_IS_SHELL=1            1 for a shell, 0 for a remote (a remote gets no manifest or proxy)
 *   MFE_BASE_PATH=/citizen    package.json mfe.basePath without trailing slash ("" for "/")
 *   MFE_REMOTES="a_b c_d"     federation names in the shell's remotes.json
 *   MFE_AUTH=1                the shell has sign-in (package.json mfe.devManifest.auth)
 *
 *   node deploy/write-shell-env.mjs <app dir> <output file>
 * Values are restricted to characters that are safe in a shell script.
 */
import fs from 'node:fs';
import path from 'node:path';

/**
 * @param {string} appDir
 * @returns {string} content of mfe-shell.env
 */
export function shellEnv(appDir) {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(appDir, 'package.json'), 'utf8'),
  );
  const tags = Array.isArray(pkg.nx?.tags) ? pkg.nx.tags : [];
  if (!tags.includes('type:shell')) return 'MFE_IS_SHELL=0\n';
  const basePath = String(pkg.mfe?.basePath ?? '/').replace(/\/+$/, '');
  if (!/^(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/.test(basePath)) {
    throw new Error(
      `${appDir}: mfe.basePath "${basePath}" is not a valid path`,
    );
  }
  const registryFile = path.join(appDir, 'remotes.json');
  const registry = fs.existsSync(registryFile)
    ? JSON.parse(fs.readFileSync(registryFile, 'utf8'))
    : {};
  /** @type {string[]} */
  const names = (Array.isArray(registry.remotes) ? registry.remotes : []).map(
    (/** @type {{ federationName?: unknown }} */ r) => r.federationName,
  );
  for (const name of names) {
    if (typeof name !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      throw new Error(`${appDir}: invalid federationName ${String(name)}`);
    }
  }
  const auth = pkg.mfe?.devManifest?.auth ? 1 : 0;
  return [
    'MFE_IS_SHELL=1',
    `MFE_BASE_PATH=${basePath}`,
    `MFE_REMOTES="${names.join(' ')}"`,
    `MFE_AUTH=${auth}`,
    '',
  ].join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  const [appDir, out] = process.argv.slice(2);
  if (!appDir || !out) {
    console.error(
      'usage: node deploy/write-shell-env.mjs <app dir> <output file>',
    );
    process.exit(2);
  }
  fs.writeFileSync(out, shellEnv(path.resolve(appDir)));
}
