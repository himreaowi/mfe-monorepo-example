import {
  eachDayOfInterval,
  format,
  isValid,
  isWeekend,
  parseISO,
} from 'date-fns';

// date-fns is a tier-3 (app-local) dependency of this remote only: see the README.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** `yyyy-MM-dd` and a real calendar date. */
export function isIsoDate(value: string): boolean {
  return ISO_DATE.test(value) && isValid(parseISO(value));
}

/** Today as `yyyy-MM-dd` in the user's time zone. */
export function todayIso(now: Date = new Date()): string {
  return format(now, 'yyyy-MM-dd');
}

/** Monday–Friday days from start to end, both included; 0 if the range is empty or invalid. */
export function countWorkingDays(start: string, end: string): number {
  if (!isIsoDate(start) || !isIsoDate(end) || end < start) return 0;
  return eachDayOfInterval({
    start: parseISO(start),
    end: parseISO(end),
  }).filter((day) => !isWeekend(day)).length;
}

/** `21 Dec 2026`. */
export function formatDate(iso: string): string {
  return isIsoDate(iso.slice(0, 10))
    ? format(parseISO(iso), 'd MMM yyyy')
    : iso;
}

/** `21 Dec 2026` or `21 Dec 2026 to 24 Dec 2026`. */
export function formatRange(start: string, end: string): string {
  return start === end
    ? formatDate(start)
    : `${formatDate(start)} to ${formatDate(end)}`;
}

/** `1 day` / `3 days`. */
export function formatDays(days: number): string {
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}
