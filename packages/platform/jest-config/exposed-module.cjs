// @ts-check
// Guard for a remote's exposed module (`src/app/apps.tsx`): the shell owns the page, so nothing
// the exposed module reaches may import global styles or register a service worker.
const fs = require('node:fs');
const path = require('node:path');

/** What an exposed module must never reach (docs/coding-conventions.md). */
const DEFAULT_FORBIDDEN = [/@org\/design-tokens\/global\.scss/, /registerPwa/];

const EXTENSIONS = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];

/**
 * @param {string} srcDir
 * @param {string} from
 * @param {string} spec
 * @returns {string | null}
 */
function resolveLocal(srcDir, from, spec) {
  let base;
  if (spec.startsWith('@/')) base = path.join(srcDir, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec);
  else return null;
  for (const ext of EXTENSIONS) {
    const candidate = `${base}${ext}`;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

/**
 * Walk the local import graph (relative and `@/` imports, styles included) from `entry` and
 * report every file that matches a forbidden pattern.
 * @param {string} entry absolute path of the exposed module
 * @param {{ srcDir?: string, forbidden?: RegExp[] }} [options] srcDir: target of the `@/` alias
 *   (default: the folder above the entry's folder, i.e. `src/` for `src/app/apps.tsx`)
 * @returns {{ files: string[], violations: { file: string, pattern: string }[] }}
 */
function scanExposedModule(entry, options = {}) {
  const srcDir = options.srcDir ?? path.dirname(path.dirname(entry));
  const forbidden = options.forbidden ?? DEFAULT_FORBIDDEN;
  const seen = new Set();
  /** @type {{ file: string, pattern: string }[]} */
  const violations = [];
  const queue = [entry];
  while (queue.length > 0) {
    const file = /** @type {string} */ (queue.pop());
    if (seen.has(file)) continue;
    seen.add(file);
    const code = fs.readFileSync(file, 'utf8');
    for (const pattern of forbidden) {
      if (pattern.test(code))
        violations.push({ file, pattern: String(pattern) });
    }
    if (!/\.tsx?$/.test(file)) continue; // a stylesheet: checked, not walked
    for (const [, spec] of code.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      const next = resolveLocal(srcDir, file, spec);
      if (next && /\.(tsx?|s?css)$/.test(next)) queue.push(next);
    }
  }
  return { files: [...seen], violations };
}

module.exports = { scanExposedModule, DEFAULT_FORBIDDEN };
