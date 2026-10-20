import { cx } from './cx';

describe('cx', () => {
  it('joins truthy class names', () => {
    expect(cx('a', false, undefined, null, '', 'b')).toBe('a b');
    expect(cx()).toBe('');
  });
});
