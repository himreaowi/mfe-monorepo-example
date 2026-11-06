import { joinBasePath, normalizeBasePath } from './hostProps';

describe('base path helpers', () => {
  it.each([
    [undefined, '/'],
    ['', '/'],
    ['/', '/'],
    ['apps/x', '/apps/x'],
    ['/apps/x/', '/apps/x'],
  ])('normalizeBasePath(%p) → %p', (input, expected) => {
    expect(normalizeBasePath(input)).toBe(expected);
  });

  it('joinBasePath', () => {
    expect(joinBasePath('/apps/x', 'route-2')).toBe('/apps/x/route-2');
    expect(joinBasePath('/apps/x/', '/route-2')).toBe('/apps/x/route-2');
    expect(joinBasePath('/', 'route-2')).toBe('/route-2');
    expect(joinBasePath('/apps/x', '')).toBe('/apps/x');
  });
});
