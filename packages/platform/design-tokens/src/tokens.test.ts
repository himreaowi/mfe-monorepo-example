import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isThemeMode, isThemePreference, THEME_STORAGE_KEY } from './index';

const css = readFileSync(join(__dirname, 'tokens.css'), 'utf8');

function colorVarsIn(selectorStart: string): string[] {
  const start = css.indexOf(selectorStart);
  const block = css.slice(start, css.indexOf('}', start));
  return [...block.matchAll(/(--color-[\w-]+)\s*:/g)].map((m) => m[1]).sort();
}

describe('design tokens', () => {
  it('dark theme overrides every light colour token', () => {
    const light = colorVarsIn(':root');
    const dark = colorVarsIn("[data-theme='dark']");
    expect(light.length).toBeGreaterThan(5);
    expect(dark).toEqual(light);
  });

  it('theme guards', () => {
    expect(isThemeMode('dark')).toBe(true);
    expect(isThemeMode('system')).toBe(false);
    expect(isThemePreference('system')).toBe(true);
    expect(isThemePreference('blue')).toBe(false);
    expect(THEME_STORAGE_KEY).toBe('mfe-theme');
  });
});
