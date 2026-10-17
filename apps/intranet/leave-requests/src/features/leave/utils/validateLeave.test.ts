import type { LeaveBalance } from '../types/leave';
import { validateLeave } from './validateLeave';

const balances: LeaveBalance[] = [
  {
    type: 'annual',
    label: 'Annual leave',
    entitled: 18,
    taken: 10,
    pending: 5,
    remaining: 3,
  },
  {
    type: 'unpaid',
    label: 'No-pay leave',
    entitled: null,
    taken: 0,
    pending: 0,
    remaining: null,
  },
];
const TODAY = '2026-10-18'; // Sunday

describe('validateLeave', () => {
  it('requires a type and both dates', () => {
    expect(
      validateLeave(
        { type: '', startDate: '', endDate: '', reason: '' },
        balances,
        TODAY,
      ),
    ).toEqual({
      type: 'Choose a leave type',
      startDate: 'Enter a start date',
      endDate: 'Enter an end date',
    });
  });

  it('rejects past, reversed and weekend-only ranges', () => {
    const check = (startDate: string, endDate: string) =>
      validateLeave(
        { type: 'unpaid', startDate, endDate, reason: '' },
        balances,
        TODAY,
      );
    expect(check('2026-10-16', '2026-10-19').startDate).toMatch(
      /today or later/,
    );
    expect(check('2026-10-21', '2026-10-20').endDate).toMatch(
      /on or after the start date/,
    );
    expect(check('2026-10-24', '2026-10-25').endDate).toMatch(/working day/);
    expect(check('2026-13-01', '2026-10-25').startDate).toMatch(/real start/);
  });

  it('checks the remaining balance; no-pay leave has no limit', () => {
    expect(
      validateLeave(
        {
          type: 'annual',
          startDate: '2026-10-19',
          endDate: '2026-10-22',
          reason: '',
        },
        balances,
        TODAY,
      ).endDate,
    ).toBe('You have 3 days of annual leave left');
    expect(
      validateLeave(
        {
          type: 'unpaid',
          startDate: '2026-10-19',
          endDate: '2026-11-30',
          reason: 'Travel',
        },
        balances,
        TODAY,
      ),
    ).toEqual({});
  });

  it('limits the reason length', () => {
    expect(
      validateLeave(
        {
          type: 'unpaid',
          startDate: '2026-10-19',
          endDate: '2026-10-19',
          reason: 'x'.repeat(301),
        },
        balances,
        TODAY,
      ).reason,
    ).toMatch(/300 characters/);
  });
});
