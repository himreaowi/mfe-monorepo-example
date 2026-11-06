import { remoteMountPath, routePaths } from './routePaths';

describe('routePaths', () => {
  it('mounts remotes on a splat route', () => {
    expect(remoteMountPath({ path: '/staff-directory' })).toBe(
      'staff-directory/*',
    );
    expect(remoteMountPath({ path: 'x/' })).toBe('x/*');
    expect(routePaths.home).toBe('/');
  });
});
