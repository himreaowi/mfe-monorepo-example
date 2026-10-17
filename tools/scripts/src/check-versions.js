// @ts-check
/**
 * check-versions: enforces the D4 dependency tiers.
 *
 * 1. A package in the catalog is referenced as `catalog:` everywhere, unless
 *    version-exceptions.json has a valid (non-expired) entry for that package + app + version.
 * 2. A third-party package used by 2+ workspace packages with a non-catalog spec must move to
 *    the catalog (tier 2).
 * 3. The tier-1 list equals TIER1_SINGLETONS in @org/rspack-config, and every tier-1 package is
 *    in the default catalog (or is a workspace package).
 * 4. version-exceptions.json is well-formed; expired entries fail.
 * Plus: workspace packages are referenced with `workspace:`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DEP_FIELDS, loadWorkspace, readJson } from './workspace.js';
import { TIER1 } from './tiers.js';

/** @typedef {{ check: string, rule: string, message: string }} Issue */
/**
 * @typedef {{
 *   package: string, version: string, app: string, reason: string, owner: string,
 *   expires: string,
 * }} VersionException
 */

const CHECK = 'check-versions';
const EXCEPTION_FIELDS = [
  'package',
  'version',
  'app',
  'reason',
  'owner',
  'expires',
];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Today as YYYY-MM-DD (UTC). */
export function today() {
  return new Date().toISOString().slice(0, 10);
}

/** `^1.2.3` / `~1.2.3` / `=1.2.3` / `v1.2.3` → `1.2.3` */
function bareVersion(/** @type {string} */ spec) {
  return spec.trim().replace(/^[\^~=v]+/, '');
}

/**
 * @param {unknown} json
 * @param {string} todayStr
 * @param {Set<string>} packageNames
 * @returns {{ exceptions: (VersionException & { index: number, expired: boolean })[], issues: Issue[] }}
 */
export function validateExceptions(json, todayStr, packageNames) {
  /** @type {Issue[]} */
  const issues = [];
  const err = (/** @type {string} */ rule, /** @type {string} */ message) =>
    issues.push({ check: CHECK, rule, message });
  const fixHint =
    'Each entry: { "package", "version", "app", "reason", "owner", "expires": "YYYY-MM-DD" }. See docs/adding-dependencies.md.';

  if (
    typeof json !== 'object' ||
    json === null ||
    !Array.isArray(/** @type {any} */ (json).exceptions)
  ) {
    err(
      'exceptions-malformed',
      `version-exceptions.json must be an object with an "exceptions" array. ${fixHint}`,
    );
    return { exceptions: [], issues };
  }
  /** @type {(VersionException & { index: number, expired: boolean })[]} */
  const exceptions = [];
  const seen = new Set();
  /** @type {unknown[]} */
  const list = /** @type {any} */ (json).exceptions;
  list.forEach((raw, index) => {
    const where = `version-exceptions.json exceptions[${index}]`;
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      err('exceptions-malformed', `${where} must be an object. ${fixHint}`);
      return;
    }
    const entry = /** @type {Record<string, unknown>} */ (raw);
    const problems = [];
    for (const field of EXCEPTION_FIELDS) {
      if (typeof entry[field] !== 'string' || entry[field].trim() === '') {
        problems.push(`"${field}" is missing or empty`);
      }
    }
    for (const key of Object.keys(entry)) {
      if (!EXCEPTION_FIELDS.includes(key) && key !== '$comment') {
        problems.push(`unknown field "${key}"`);
      }
    }
    const expires = String(entry.expires ?? '');
    if (
      typeof entry.expires === 'string' &&
      (!DATE.test(expires) ||
        Number.isNaN(Date.parse(`${expires}T00:00:00Z`)) ||
        new Date(`${expires}T00:00:00Z`).toISOString().slice(0, 10) !== expires)
    ) {
      problems.push(
        `"expires" must be a real date YYYY-MM-DD (got "${expires}")`,
      );
    }
    if (typeof entry.reason === 'string' && entry.reason.trim().length < 10) {
      problems.push('"reason" must explain why (at least 10 characters)');
    }
    if (
      typeof entry.app === 'string' &&
      entry.app &&
      !packageNames.has(entry.app)
    ) {
      problems.push(
        `"app" must be a workspace package name (no package named "${entry.app}")`,
      );
    }
    if (problems.length > 0) {
      err(
        'exceptions-malformed',
        `${where} (${String(entry.package ?? '?')} in ${String(entry.app ?? '?')}): ${problems.join('; ')}. ${fixHint}`,
      );
      return;
    }
    const e = /** @type {VersionException} */ (/** @type {unknown} */ (entry));
    const key = `${e.package}\u0000${e.app}`;
    if (seen.has(key)) {
      err(
        'exceptions-malformed',
        `${where}: duplicate exception for ${e.package} in ${e.app}. Keep one entry.`,
      );
      return;
    }
    seen.add(key);
    const expired = e.expires < todayStr;
    if (expired) {
      err(
        'exception-expired',
        `${where}: the exception for ${e.package}@${e.version} in ${e.app} expired on ${e.expires} (owner: ${e.owner}). Move ${e.app} back to "catalog:" (pnpm --filter ${e.app} add ${e.package}@catalog:) or, if still needed, renew it with a new "expires" date and an updated reason (needs review).`,
      );
    }
    exceptions.push({ ...e, index, expired });
  });
  return { exceptions, issues };
}

/**
 * Highest-looking version among specs (for the suggested catalog entry).
 * @param {string[]} specs
 */
function suggestVersion(specs) {
  const parse = (/** @type {string} */ s) =>
    bareVersion(s)
      .split(/[.+-]/)
      .slice(0, 3)
      .map((n) => Number.parseInt(n, 10) || 0);
  return [...specs].sort((a, b) => {
    const pa = parse(a);
    const pb = parse(b);
    for (let i = 0; i < 3; i += 1) {
      if (pa[i] !== pb[i]) return (pb[i] ?? 0) - (pa[i] ?? 0);
    }
    return 0;
  })[0];
}

/**
 * Load the tier-1 singleton list of @org/rspack-config (lightweight module, no Rspack import).
 * @param {string} root
 * @returns {Promise<string[] | null>}
 */
export async function loadTier1Singletons(root) {
  const file = path.join(root, 'packages', 'rspack-config', 'src', 'tier1.js');
  if (!fs.existsSync(file)) return null;
  const mod = await import(new URL(`file://${file}`).href);
  return mod.TIER1_SINGLETONS ?? null;
}

/**
 * @param {{
 *   root: string,
 *   today?: string,
 *   tier1?: string[],
 *   tier1Singletons?: string[] | null,
 * }} options
 * @returns {Promise<{ errors: Issue[], warnings: Issue[] }>}
 */
export async function checkVersions({
  root,
  today: todayStr = today(),
  tier1 = TIER1,
  tier1Singletons,
}) {
  /** @type {Issue[]} */
  const errors = [];
  /** @type {Issue[]} */
  const warnings = [];
  const err = (/** @type {string} */ rule, /** @type {string} */ message) =>
    errors.push({ check: CHECK, rule, message });
  const warn = (/** @type {string} */ rule, /** @type {string} */ message) =>
    warnings.push({ check: CHECK, rule, message });

  const { catalogs, packages } = loadWorkspace(root);
  const defaultCatalog = catalogs.default ?? {};
  const workspaceNames = new Set(packages.map((p) => p.name));

  // --- exceptions ---------------------------------------------------------------------------
  const exceptionsFile = path.join(root, 'version-exceptions.json');
  let exceptionsJson = { exceptions: [] };
  if (fs.existsSync(exceptionsFile)) {
    try {
      exceptionsJson = readJson(exceptionsFile);
    } catch (e) {
      err(
        'exceptions-malformed',
        `version-exceptions.json is not valid JSON: ${/** @type {Error} */ (e).message}`,
      );
    }
  }
  const { exceptions, issues } = validateExceptions(
    exceptionsJson,
    todayStr,
    workspaceNames,
  );
  errors.push(...issues);
  /** @type {Set<number>} */
  const usedExceptions = new Set();
  const findException = (
    /** @type {string} */ dep,
    /** @type {string} */ app,
  ) => exceptions.find((e) => e.package === dep && e.app === app);

  // --- every dependency ---------------------------------------------------------------------
  /** @type {Map<string, { pkg: string, file: string, spec: string }[]>} */
  const nonCatalogUsers = new Map();

  for (const p of packages) {
    for (const field of DEP_FIELDS) {
      const deps = p.pkg[field] ?? {};
      for (const [dep, rawSpec] of Object.entries(deps)) {
        const spec = String(rawSpec);
        const where = `${p.name} (${p.file} ${field})`;

        if (spec.startsWith('workspace:')) {
          if (!workspaceNames.has(dep)) {
            err(
              'workspace-unknown',
              `${where}: "${dep}": "${spec}" but there is no workspace package named ${dep}.`,
            );
          }
          continue;
        }
        if (workspaceNames.has(dep)) {
          err(
            'workspace-protocol',
            `${where}: "${dep}": "${spec}" must be "workspace:*" (${dep} is a workspace package).`,
          );
          continue;
        }
        if (spec.startsWith('catalog:')) {
          const catalogName = spec.slice('catalog:'.length) || 'default';
          if (!catalogs[catalogName] || !(dep in catalogs[catalogName])) {
            err(
              'catalog-missing',
              `${where}: "${dep}": "${spec}" but the ${catalogName} catalog in pnpm-workspace.yaml has no entry for ${dep}. Add "${dep}: <version>" under ${catalogName === 'default' ? '"catalog:"' : `"catalogs.${catalogName}"`}.`,
            );
          }
          continue;
        }

        const inCatalog = dep in defaultCatalog;
        if (inCatalog) {
          const exception = findException(dep, p.name);
          const isTier1 = tier1.includes(dep);
          if (exception) {
            usedExceptions.add(exception.index);
            if (exception.expired) continue; // already reported as expired
            if (
              exception.version !== spec &&
              bareVersion(exception.version) !== bareVersion(spec)
            ) {
              err(
                'exception-mismatch',
                `${where}: "${dep}": "${spec}" does not match the exception in version-exceptions.json (version "${exception.version}"). Update one of them so they agree.`,
              );
            }
            continue;
          }
          err(
            isTier1 ? 'tier1-pinned' : 'catalog-bypassed',
            `${where}: "${dep}": "${spec}" — ${dep} is in the catalog (${defaultCatalog[dep]})${isTier1 ? ' and is a tier-1 singleton shared at runtime' : ''}, so it must be "catalog:".\n` +
              `    Fix: set "${dep}": "catalog:" (or run: pnpm --filter ${p.name} add ${dep}@catalog:).\n` +
              `    If ${p.name} really needs ${spec}, add an exception to version-exceptions.json: ` +
              `{ "package": "${dep}", "version": "${bareVersion(spec)}", "app": "${p.name}", "reason": "...", "owner": "...", "expires": "YYYY-MM-DD" }` +
              (isTier1
                ? `. A different major of a tier-1 package cannot share the runtime singleton: integrate the app as an isolated mount-contract module (docs/external-modules.md).`
                : '.'),
          );
          continue;
        }

        const list = nonCatalogUsers.get(dep) ?? [];
        list.push({ pkg: p.name, file: p.file, spec });
        nonCatalogUsers.set(dep, list);
      }
    }
  }

  // --- tier 2: shared third-party deps must be in the catalog --------------------------------
  for (const [dep, users] of [...nonCatalogUsers].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const counted = users.filter((u) => {
      const exception = findException(dep, u.pkg);
      if (exception) usedExceptions.add(exception.index);
      return !exception || exception.expired;
    });
    const distinct = new Set(counted.map((u) => u.pkg));
    if (distinct.size < 2) continue;
    const version = bareVersion(suggestVersion(counted.map((u) => u.spec)));
    err(
      'shared-not-in-catalog',
      `${dep} is used by ${distinct.size} workspace packages without the catalog: ${counted
        .map((u) => `${u.pkg} ("${u.spec}")`)
        .join(
          ', ',
        )}. A dependency used by 2+ apps/packages is tier 2 and must have one version in the catalog.\n` +
        `    Fix: add "${dep}: ${version}" under "catalog:" in pnpm-workspace.yaml, then point every user at it: ${[...distinct].map((u) => `pnpm --filter ${u} add ${dep}@catalog:`).join(' && ')}.`,
    );
  }

  // --- tier 1 --------------------------------------------------------------------------------
  const singletons =
    tier1Singletons === undefined
      ? await loadTier1Singletons(root)
      : tier1Singletons;
  if (singletons) {
    const a = [...tier1].sort();
    const b = [...singletons].sort();
    if (a.join('\n') !== b.join('\n')) {
      const missing = a.filter((x) => !b.includes(x));
      const extra = b.filter((x) => !a.includes(x));
      err(
        'tier1-drift',
        `The tier-1 list (tools/scripts/src/tiers.js: ${a.join(', ')}) differs from TIER1_SINGLETONS in packages/rspack-config/src/tier1.js (${b.join(', ')}).` +
          (missing.length
            ? ` Not shared as singleton: ${missing.join(', ')}.`
            : '') +
          (extra.length ? ` Shared but not tier 1: ${extra.join(', ')}.` : '') +
          ' Change both lists together (and docs/adding-dependencies.md).',
      );
    }
  } else {
    warn(
      'tier1-unverified',
      'packages/rspack-config/src/tier1.js not found; tier-1 list not compared with the Module Federation singletons.',
    );
  }
  for (const dep of tier1) {
    if (dep.startsWith('@org/')) {
      if (!workspaceNames.has(dep)) {
        err(
          'tier1-missing',
          `Tier-1 package ${dep} is not a workspace package.`,
        );
      }
    } else if (!(dep in defaultCatalog)) {
      err(
        'tier1-missing',
        `Tier-1 package ${dep} is not in the default catalog. Add "${dep}: <version>" under "catalog:" in pnpm-workspace.yaml.`,
      );
    }
  }

  // --- stale exceptions ----------------------------------------------------------------------
  for (const e of exceptions) {
    if (!usedExceptions.has(e.index) && !e.expired) {
      warn(
        'exception-unused',
        `version-exceptions.json exceptions[${e.index}] (${e.package} in ${e.app}) is not used: ${e.app} does not pin ${e.package}. Remove the entry.`,
      );
    }
  }

  return { errors, warnings };
}
