import { formatDate } from './formatDate';

describe('formatDate', () => {
  it('formats in Singapore time, passes invalid input through', () => {
    expect(formatDate('2026-10-16T09:00:00+08:00')).toBe('16 October 2026');
    expect(formatDate('2026-10-15T23:30:00Z')).toBe('16 October 2026');
    expect(formatDate('soon')).toBe('soon');
  });
});
