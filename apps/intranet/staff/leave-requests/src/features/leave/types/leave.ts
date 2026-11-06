export type LeaveType = 'annual' | 'sick' | 'childcare' | 'unpaid';

export type LeaveBalance = {
  type: LeaveType;
  label: string;
  /** Days per year; `null` = no limit (no-pay leave). */
  entitled: number | null;
  taken: number;
  pending: number;
  /** `null` = no limit. */
  remaining: number | null;
};

export type LeaveBalances = { year: number; balances: LeaveBalance[] };

export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export type LeaveRequest = {
  id: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  createdAt: string;
  /** The colleague covering during the leave, when the request named one. */
  cover?: { id: string; name: string } | null;
};

/** What the form sends. Dates are `yyyy-MM-dd`. */
export type LeaveRequestInput = {
  type: LeaveType | '';
  startDate: string;
  endDate: string;
  reason: string;
  /** Staff id of the covering colleague (optional). */
  coverId?: string;
};

export type LeaveField = keyof LeaveRequestInput;
export type LeaveFieldErrors = Partial<Record<LeaveField, string>>;
