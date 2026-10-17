import type {
  LeaveBalance,
  LeaveFieldErrors,
  LeaveRequestInput,
} from '../types/leave';
import { countWorkingDays, formatDays, isIsoDate, todayIso } from './dates';

export const MAX_REASON_LENGTH = 300;

/**
 * Field errors for a leave request (empty object = valid). Same rules as the API, which stays
 * the authority (it answers 422 with field errors).
 */
export function validateLeave(
  input: LeaveRequestInput,
  balances: LeaveBalance[],
  today: string = todayIso(),
): LeaveFieldErrors {
  const errors: LeaveFieldErrors = {};
  const balance = balances.find((b) => b.type === input.type);
  if (!input.type || !balance) errors.type = 'Choose a leave type';

  const start = input.startDate.trim();
  const end = input.endDate.trim();
  if (!start) errors.startDate = 'Enter a start date';
  else if (!isIsoDate(start)) errors.startDate = 'Enter a real start date';
  else if (start < today)
    errors.startDate = 'The start date must be today or later';

  if (!end) errors.endDate = 'Enter an end date';
  else if (!isIsoDate(end)) errors.endDate = 'Enter a real end date';
  else if (!errors.startDate && end < start)
    errors.endDate = 'The end date must be on or after the start date';

  if (!errors.startDate && !errors.endDate) {
    const days = countWorkingDays(start, end);
    if (days === 0) {
      errors.endDate = 'Choose dates that include at least one working day';
    } else if (
      balance &&
      balance.remaining !== null &&
      days > balance.remaining
    ) {
      errors.endDate = `You have ${formatDays(balance.remaining)} of ${balance.label.toLowerCase()} left`;
    }
  }

  if (input.reason.trim().length > MAX_REASON_LENGTH) {
    errors.reason = `Reason must be ${MAX_REASON_LENGTH} characters or fewer`;
  }
  return errors;
}
