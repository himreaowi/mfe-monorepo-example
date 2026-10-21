// @ts-check
/**
 * `pnpm check` (check-env): the `.env` files of the zones and shells (src/env.js,
 * docs/configuration.md).
 *
 * - no real `.env` / `.env.*` file (anything but `.env.example`) is tracked by git, and the
 *   root .gitignore ignores them;
 * - every zone with a shell has `apps/<zone>/.env.example`;
 * - that file documents every variable the dev and deploy tooling reads (ENV_VARIABLES) and a
 *   `REMOTE_<FEDERATION_NAME>_URL` for every remote registered by a shell of the zone (a
 *   commented `# NAME=value` line counts as documented);
 * - a shell's own `.env.example` only lists variables the tooling knows.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { shellDirs, REGISTRY_FILE } from './dev-manifest.js';
import {
  ENV_EXAMPLE_FILE,
  ENV_VARIABLES,
  remotePropsVariable,
  remoteUrlVariable,
} from './env.js';
import { readJson } from './workspace.js';

const CHECK = 'check-env';

/** @typedef {{ check: string, rule: string, message: string }} Issue */

/** Real env files: `.env`, `.env.local`, `.env.uat`, … but not `.env.example`. */
const REAL_ENV_FILE = /^\.env(?:\..+)?$/;

/**
 * Variable names set (or documented in a comment) by a `NAME=value` line.
 * @param {string} text
 * @returns {Set<string>}
 */
export function documentedVariables(text) {
  return new Set(
    [...text.matchAll(/^[ \t]*#?[ \t]*([A-Z][A-Z0-9_]*)[ \t]*=/gm)].map(
      (m) => m[1],
    ),
  );
}

/**
 * @param {string} root
 * @returns {string[] | undefined} tracked files, `undefined` when root is not a git checkout
 */
function trackedFiles(root) {
  try {
    return execFileSync('git', ['ls-files', '-z'], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 64 * 1024 * 1024,
    })
      .toString()
      .split('\0')
      .filter(Boolean);
  } catch {
    return undefined;
  }
}

/**
 * @param {{ root: string }} options
 * @returns {Promise<{ errors: Issue[], warnings: Issue[] }>}
 */
export async function checkEnv({ root }) {
  /** @type {Issue[]} */
  const errors = [];
  const err = (/** @type {string} */ rule, /** @type {string} */ message) =>
    errors.push({ check: CHECK, rule, message });

  const tracked = trackedFiles(root);
  for (const file of tracked ?? []) {
    const base = path.posix.basename(file);
    if (REAL_ENV_FILE.test(base) && base !== ENV_EXAMPLE_FILE) {
      err(
        'env-tracked',
        `${file} is tracked by git. Real .env files hold per-environment values and must not be committed: run "git rm --cached ${file}" and keep the variables in the deployment's variable group (docs/configuration.md); document them in ${ENV_EXAMPLE_FILE} instead.`,
      );
    }
  }
  const gitignore = path.join(root, '.gitignore');
  if (
    fs.existsSync(gitignore) &&
    !/^\.env\.\*$/m.test(fs.readFileSync(gitignore, 'utf8'))
  ) {
    err(
      'env-ignored',
      '.gitignore must ignore real env files: add the lines ".env", ".env.*" and "!.env.example".',
    );
  }

  /** @type {Map<string, { dirs: string[], remotes: Set<string> }>} */
  const zones = new Map();
  for (const dir of shellDirs(root)) {
    const zone = path.relative(root, dir).split(path.sep)[1];
    const entry = zones.get(zone) ?? { dirs: [], remotes: new Set() };
    entry.dirs.push(dir);
    const registryFile = path.join(dir, REGISTRY_FILE);
    const registry = fs.existsSync(registryFile) ? readJson(registryFile) : {};
    /** @type {Map<string, string>} */
    const byVariable = new Map();
    for (const r of Array.isArray(registry.remotes) ? registry.remotes : []) {
      if (typeof r?.federationName !== 'string') continue;
      entry.remotes.add(r.federationName);
      const variable = remoteUrlVariable(r.federationName);
      const clash = byVariable.get(variable);
      if (clash && clash !== r.federationName) {
        err(
          'env-remote-name',
          `${path.relative(root, registryFile)}: federation names "${clash}" and "${r.federationName}" both map to ${variable}. Rename one (federation names differ by more than letter case).`,
        );
      }
      byVariable.set(variable, r.federationName);
    }
    zones.set(zone, entry);
  }

  for (const [zone, { dirs, remotes }] of zones) {
    const example = path.join(root, 'apps', zone, ENV_EXAMPLE_FILE);
    const rel = path.relative(root, example);
    const known = new Set(Object.keys(ENV_VARIABLES));
    for (const name of remotes) {
      known.add(remoteUrlVariable(name));
      known.add(remotePropsVariable(name));
    }
    if (!fs.existsSync(example)) {
      err(
        'env-example',
        `${rel} is missing: every zone with shells has a committed ${ENV_EXAMPLE_FILE} listing the variables of the dev proxy and the deployment (docs/configuration.md). Copy one from another zone or run pnpm gen:shell.`,
      );
    } else {
      const documented = documentedVariables(fs.readFileSync(example, 'utf8'));
      const required = [
        ...Object.keys(ENV_VARIABLES),
        ...[...remotes].map(remoteUrlVariable),
      ];
      const missing = required.filter((v) => !documented.has(v));
      if (missing.length > 0) {
        err(
          'env-example',
          `${rel} does not document ${missing.join(', ')}. List every variable the dev proxy and the deploy image read, with a comment (a commented "# NAME=value" line is enough).`,
        );
      }
    }
    for (const dir of dirs) {
      const shellExample = path.join(path.dirname(dir), ENV_EXAMPLE_FILE);
      if (!fs.existsSync(shellExample)) continue;
      const unknown = [
        ...documentedVariables(fs.readFileSync(shellExample, 'utf8')),
      ].filter((v) => !known.has(v));
      if (unknown.length > 0) {
        err(
          'env-example',
          `${path.relative(root, shellExample)} lists ${unknown.join(', ')}, which neither the tooling (src/env.js ENV_VARIABLES) nor this shell's remotes use.`,
        );
      }
    }
  }
  return { errors, warnings: [] };
}
