// @ts-check

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** `2026-10-18` and a real calendar date. @param {unknown} value @returns {value is string} */
export function isIsoDate(value) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/**
 * Monday–Friday days from `start` to `end`, both included (public holidays are ignored in the
 * mock). 0 when `end` is before `start`.
 * @param {string} start @param {string} end
 */
export function countWorkingDays(start, end) {
  const day = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  let count = 0;
  while (day <= last) {
    const weekday = day.getUTCDay();
    if (weekday !== 0 && weekday !== 6) count += 1;
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return count;
}

/** ISO timestamp `days` before now (seed data stays recent). @param {number} days */
export function daysAgo(days) {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}
