import type { LeaveBalances, LeaveRequest } from '../types/leave';

export const balances: LeaveBalances = {
  year: 2026,
  balances: [
    {
      type: 'annual',
      label: 'Annual leave',
      entitled: 18,
      taken: 7,
      pending: 4,
      remaining: 7,
    },
    {
      type: 'unpaid',
      label: 'No-pay leave',
      entitled: null,
      taken: 0,
      pending: 0,
      remaining: null,
    },
  ],
};

export const request: LeaveRequest = {
  id: 'LR-0005',
  type: 'annual',
  startDate: '2026-12-21',
  endDate: '2026-12-24',
  days: 4,
  reason: 'Year-end break',
  status: 'pending',
  createdAt: '2026-10-15T08:00:00.000Z',
};
