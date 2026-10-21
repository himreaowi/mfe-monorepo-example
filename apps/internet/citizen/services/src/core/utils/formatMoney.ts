export type Money = { amount: number; currency: string };

/** `SGD 15.00` from an amount in cents; `Free` for no fee. */
export function formatFee(fee: Money | null, locale = 'en-SG'): string {
  if (!fee) return 'Free';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: fee.currency,
      currencyDisplay: 'code',
    })
      .format(fee.amount / 100)
      .replace(/\u00a0/g, ' ');
  } catch {
    return `${fee.currency} ${(fee.amount / 100).toFixed(2)}`;
  }
}
