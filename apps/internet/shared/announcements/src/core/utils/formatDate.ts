/** `16 October 2026` (Intl, no date library needed for display only). */
export function formatDate(iso: string, locale = 'en-SG'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Singapore',
  }).format(date);
}
