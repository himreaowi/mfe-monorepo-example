// @ts-check
/**
 * "Bright Payments" vendor: pure helpers (no DOM), unit tested with node --test.
 */

export const METHODS = [
  {
    value: 'paynow',
    label: 'PayNow',
    hint: 'Scan a QR code with your banking app',
  },
  { value: 'card', label: 'Credit or debit card', hint: 'Visa or Mastercard' },
];

/**
 * @typedef {{ description: string, amount: number, currency: string, title: string }} Bill
 * @typedef {{ reference: string, amount: number, currency: string, method: string,
 *   description: string, paidAt: string }} Payment
 */

/**
 * Validate `props.config` from the host's manifest. `amount` is in cents.
 * @param {Readonly<Record<string, unknown>>} config
 * @returns {{ ok: true, bill: Bill } | { ok: false, message: string }}
 */
export function readBill(config) {
  const amount = config.amount;
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
    return {
      ok: false,
      message: 'config.amount must be a positive whole number of cents',
    };
  }
  const currency =
    typeof config.currency === 'string' ? config.currency : 'SGD';
  if (!/^[A-Z]{3}$/.test(currency)) {
    return {
      ok: false,
      message: 'config.currency must be a 3-letter currency code',
    };
  }
  const description =
    typeof config.description === 'string' && config.description.trim()
      ? config.description.trim()
      : 'Payment';
  const title =
    typeof config.title === 'string' && config.title.trim()
      ? config.title.trim()
      : 'Pay';
  return { ok: true, bill: { amount, currency, description, title } };
}

/** `SGD 15.00` style amount. @param {number} cents @param {string} currency @param {string} locale */
export function formatAmount(cents, currency, locale) {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay: 'code',
    })
      .format(cents / 100)
      .replace(/\u00a0/g, ' ');
  } catch {
    return `${currency} ${(cents / 100).toFixed(2)}`;
  }
}

/** `BP-20261018-0001`. @param {Date} date @param {number} sequence */
export function createReference(date, sequence) {
  const day = date.toISOString().slice(0, 10).replaceAll('-', '');
  return `BP-${day}-${String(sequence).padStart(4, '0')}`;
}

/**
 * The vendor's own routes on `props.path`.
 * @param {string} path
 * @returns {{ view: 'checkout' } | { view: 'receipt', reference: string }}
 */
export function parseRoute(path) {
  const receipt = /^receipt\/(BP-\d{8}-\d{4})$/.exec(path);
  return receipt
    ? { view: 'receipt', reference: receipt[1] }
    : { view: 'checkout' };
}
