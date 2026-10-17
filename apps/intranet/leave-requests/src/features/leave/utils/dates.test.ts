import {
  countWorkingDays,
  formatDate,
  formatDays,
  formatRange,
  isIsoDate,
  todayIso,
} from './dates';

describe('leave dates (date-fns)', () => {
  it('counts Monday to Friday, both ends included', () => {
    expect(countWorkingDays('2026-12-21', '2026-12-24')).toBe(4); // Mon–Thu
    expect(countWorkingDays('2026-10-19', '2026-10-25')).toBe(5); // Mon–Sun
    expect(countWorkingDays('2026-10-24', '2026-10-25')).toBe(0); // weekend
    expect(countWorkingDays('2026-10-20', '2026-10-19')).toBe(0);
    expect(countWorkingDays('', '2026-10-19')).toBe(0);
  });

  it('validates and formats dates', () => {
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(formatDate('2026-12-21')).toBe('21 Dec 2026');
    expect(formatDate('2026-12-21T09:00:00.000Z')).toMatch(/Dec 2026/);
    expect(formatRange('2026-12-21', '2026-12-21')).toBe('21 Dec 2026');
    expect(formatRange('2026-12-21', '2026-12-24')).toBe(
      '21 Dec 2026 to 24 Dec 2026',
    );
    expect(formatDays(1)).toBe('1 day');
    expect(formatDays(3)).toBe('3 days');
    expect(todayIso(new Date(2026, 9, 18, 23, 30))).toBe('2026-10-18');
  });
});
