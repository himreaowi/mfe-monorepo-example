// @ts-check
/**
 * `.env` files of the dev and deploy tooling (docs/configuration.md).
 *
 * Layering for a shell, strongest first: the real environment (`process.env`, CI, `docker run
 * -e`) > `apps/<zone>/shell-<name>/.env` > `apps/<zone>/.env` > built-in defaults (the callers',
 * e.g. the dev proxy's mock API). Files are parsed with Node's built-in `util.parseEnv`
 * (no dotenv dependency) and never written into `process.env`.
 *
 * Real `.env` files are git-ignored and `pnpm check` fails when one is tracked; the committed
 * `.env.example` next to each lists every variable (see check-env.js).
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';

/** Name of the (git-ignored) env file in a zone folder and in a shell folder. */
export const ENV_FILE = '.env';
/** Name of the committed template next to it. */
export const ENV_EXAMPLE_FILE = '.env.example';

/**
 * Variables of the dev tooling and the deploy image (Dockerfile ENV, nginx templates and
 * deploy/docker-entrypoint.d/40-mfe-manifest.sh), with where they apply. Every one must be
 * documented in each zone's `.env.example` (`pnpm check`). Per-remote variables follow the
 * convention in `remoteUrlVariable()` / `remotePropsVariable()`.
 */
export const ENV_VARIABLES = /** @type {const} */ ({
  API_UPSTREAM: 'dev, deploy',
  AUTH_UPSTREAM: 'dev, deploy',
  MFE_ENVIRONMENT: 'deploy',
  MFE_CORS_ORIGINS_REGEX: 'deploy',
  CSP_REMOTE_ORIGINS: 'deploy',
  CSP_VENDOR_ORIGINS: 'deploy',
  CSP_FRAME_SRC: 'deploy',
  CSP_EXTRA: 'deploy',
  PERMISSIONS_POLICY: 'deploy',
  NGINX_PORT: 'deploy',
  MFE_MANIFEST_JSON: 'deploy (override)',
});

/**
 * Variable holding a remote's entry URL in a shell container: `REMOTE_<FEDERATION_NAME>_URL`,
 * the federation name upper-cased (`intranet_staff_directory` →
 * `REMOTE_INTRANET_STAFF_DIRECTORY_URL`). Same rule as the entrypoint script.
 * @param {string} federationName
 */
export function remoteUrlVariable(federationName) {
  return `REMOTE_${federationName.toUpperCase()}_URL`;
}

/**
 * Optional variable with a remote's extra `props` as one JSON object (e.g. an external adapter's
 * `vendor` config): `REMOTE_<FEDERATION_NAME>_PROPS`.
 * @param {string} federationName
 */
export function remotePropsVariable(federationName) {
  return `REMOTE_${federationName.toUpperCase()}_PROPS`;
}

/**
 * Parse one env file; `{}` when it does not exist.
 * @param {string} file
 * @returns {Record<string, string>}
 */
export function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  return /** @type {Record<string, string>} */ (
    parseEnv(fs.readFileSync(file, 'utf8'))
  );
}

/**
 * The effective variables of a shell: real environment > shell .env > zone .env.
 * @param {{ root: string, zone: string, shellDir: string, env?: NodeJS.ProcessEnv }} options
 *   `shellDir`: absolute path of apps/<zone>/shell-<name>; `env`: the real environment
 *   (default `process.env`)
 * @returns {{ values: Record<string, string>, files: string[] }} `files`: the env files that
 *   exist and were read (zone first)
 */
export function loadShellEnv({ root, zone, shellDir, env = process.env }) {
  const candidates = [
    path.join(root, 'apps', zone, ENV_FILE),
    path.join(shellDir, ENV_FILE),
  ];
  /** @type {Record<string, string>} */
  const values = {};
  /** @type {string[]} */
  const files = [];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    files.push(file);
    Object.assign(values, readEnvFile(file));
  }
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined && Object.hasOwn(values, key)) values[key] = value;
  }
  // real environment wins for every variable the tooling knows, even when no file sets it
  for (const key of [...Object.keys(ENV_VARIABLES)]) {
    const value = env[key];
    if (value !== undefined) values[key] = value;
  }
  return { values, files };
}

/**
 * Text of a zone's committed `.env.example`.
 * @param {{ zone: string, mockApiUrl?: string, remotes?: string[] }} options
 *   `mockApiUrl`: the zone's mock API (the dev default of API_UPSTREAM); `remotes`: federation
 *   names of the remotes the zone's shells register
 */
export function renderZoneEnvExample({ zone, mockApiUrl, remotes = [] }) {
  return `# ${zone} zone: variables shared by every shell of the zone. A shell can override any of them
# in apps/${zone}/shell-<name>/.env (see that folder's .env.example).
#
# Copy this file to .env (git-ignored; never commit real values) to change the defaults.
#   - local dev: \`pnpm dev:${zone}\` reads it (the dev proxy forwards <base path>/api and
#     <base path>/auth like nginx does in production)
#   - deployment: \`docker run --env-file apps/${zone}/.env ...\`, or the same variables from the
#     environment's Azure DevOps variable group (docs/configuration.md)
# Precedence: real environment > shell .env > zone .env > defaults.
#
# Everything here is SERVER-SIDE. None of it reaches the browser: the browser only calls
# <base path>/api and <base path>/auth on its own origin, and the generated mfe-manifest.json
# lists relative URLs only. Put no secrets in this file that you would not put in a variable group.

# --- backends (dev and deployment) -----------------------------------------------------------
# Where <base path>/api is forwarded (the rest of the path is appended). Dev default: the zone's
# mock API. Point it at a real UAT API to develop against it.
# API_UPSTREAM=${mockApiUrl ?? 'https://api.uat.example.sg/v1'}
# Where <base path>/auth is forwarded: the sign-in BFF (session, login, logout). Deployment:
# required for a shell with sign-in. Dev: unset, the shell uses the mock sign-in.
# AUTH_UPSTREAM=https://bff.uat.example.sg
# Shown as settings.environment in the manifest (uat, production, ...). Deployment only.
# MFE_ENVIRONMENT=uat

# --- web server and security headers (deployment only) ---------------------------------------
# NGINX_PORT=8080
# Origins of the shells that may load this container's files cross-origin (regex)
# MFE_CORS_ORIGINS_REGEX=^https://portal\\.example\\.sg$
# Space-separated origins added to the CSP: remotes' hosts, vendor hosts, iframes, extras
# CSP_REMOTE_ORIGINS=https://cdn.example.sg
# CSP_VENDOR_ORIGINS=
# CSP_FRAME_SRC='none'
# CSP_EXTRA=
# PERMISSIONS_POLICY=camera=(), microphone=(), geolocation=(), payment=()
# A complete manifest instead of the variables (rarely needed; docs/configuration.md)
# MFE_MANIFEST_JSON=

# --- remotes (deployment only; dev uses the remotes' own dev servers) ------------------------
# Entry URL (mf-manifest.json) of each remote a shell registers: REMOTE_<FEDERATION_NAME>_URL.
# Optional REMOTE_<FEDERATION_NAME>_PROPS: that remote's extra props as one line of JSON.
${remotes.map((n) => `# ${remoteUrlVariable(n)}=https://${n.replaceAll('_', '-')}.example.sg/mf-manifest.json`).join('\n')}
`;
}

/**
 * Text of a shell's committed `.env.example` (overrides for that shell only).
 * @param {{ zone: string, name: string, basePath: string }} options
 */
export function renderShellEnvExample({ zone, name, basePath }) {
  return `# Overrides for the ${name} shell (${basePath}) of the ${zone} zone. Copy to .env (git-ignored).
# Wins over apps/${zone}/.env; list only what differs from the zone. Server-side only
# (docs/configuration.md). Precedence: real environment > this file > zone .env > defaults.

# Backend of ${basePath === '/' ? '' : basePath}/api for this shell
# API_UPSTREAM=
# Sign-in BFF behind ${basePath === '/' ? '' : basePath}/auth
# AUTH_UPSTREAM=
`;
}

/**
 * Make sure `apps/<zone>/.env.example` exists and documents every remote: creates it, or
 * appends the missing `# REMOTE_<NAME>_URL=` lines to the end of an existing one.
 * @param {{ root: string, zone: string, mockApiUrl?: string, remotes: string[] }} options
 * @returns {boolean} whether the file changed
 */
export function syncZoneEnvExample({ root, zone, mockApiUrl, remotes }) {
  const file = path.join(root, 'apps', zone, ENV_EXAMPLE_FILE);
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, renderZoneEnvExample({ zone, mockApiUrl, remotes }));
    return true;
  }
  const text = fs.readFileSync(file, 'utf8');
  const missing = remotes.filter(
    (n) =>
      !new RegExp(`^[ \\t]*#?[ \\t]*${remoteUrlVariable(n)}[ \\t]*=`, 'm').test(
        text,
      ),
  );
  if (missing.length === 0) return false;
  fs.writeFileSync(
    file,
    `${text.replace(/\n*$/, '\n')}${missing
      .map(
        (n) =>
          `# ${remoteUrlVariable(n)}=https://${n.replaceAll('_', '-')}.example.sg/mf-manifest.json\n`,
      )
      .join('')}`,
  );
  return true;
}
