import fs from 'node:fs';
import path from 'node:path';

/**
 * The exposed module must not pull in global styles or the service worker: the shell owns the
 * page (see @org/ui ThemeProvider docs). Walks the relative/alias import graph from the expose,
 * through each component folder's index.ts, and also checks the CSS modules it reaches.
 */
const SRC = path.join(__dirname, '..');
const FORBIDDEN = [/@org\/design-tokens\/global\.scss/, /registerPwa/];
const COMPONENT_FILE =
  /[\\/]features[\\/][^\\/]+[\\/]components[\\/][^\\/]+[\\/][^\\/]+\.tsx$/;

function resolveLocal(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec);
  else return null;
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
  ]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

describe('exposed module', () => {
  it('does not import global styles or register a service worker', () => {
    const seen = new Set<string>();
    const queue = [path.join(SRC, 'app', 'RemoteApp.tsx')];
    while (queue.length > 0) {
      const file = queue.pop()!;
      if (seen.has(file)) continue;
      seen.add(file);
      const code = fs.readFileSync(file, 'utf8');
      for (const pattern of FORBIDDEN) {
        expect({ file, match: pattern.test(code) }).toEqual({
          file,
          match: false,
        });
      }
      if (!/\.tsx?$/.test(file)) continue; // a CSS module: checked, not walked
      for (const [, spec] of code.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        const next = resolveLocal(file, spec);
        if (next && /\.(tsx?|scss)$/.test(next)) queue.push(next);
      }
    }
    expect(seen.size).toBeGreaterThan(3);
    // the walk reached the feature components (features/<name>/components/<Name>/<Name>.tsx)
    expect([...seen].some((file) => COMPONENT_FILE.test(file))).toBe(true);
  });
});
