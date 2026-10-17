import type { ExternalModuleReportedError } from '@org/mf-runtime/external';

/** What the host keeps from the vendor's `payment:completed` event. */
export type CompletedPayment = {
  reference: string;
  amount: number;
  currency: string;
  description: string;
};

/** Validate the untrusted event detail; `null` if it is not a usable payment. */
export function readCompletedPayment(detail: unknown): CompletedPayment | null {
  if (typeof detail !== 'object' || detail === null) return null;
  const d = detail as Record<string, unknown>;
  if (
    typeof d.reference !== 'string' ||
    !/^[A-Z0-9-]{1,40}$/.test(d.reference) ||
    typeof d.amount !== 'number' ||
    !Number.isInteger(d.amount) ||
    typeof d.currency !== 'string'
  ) {
    return null;
  }
  return {
    reference: d.reference,
    amount: d.amount,
    currency: d.currency,
    description: typeof d.description === 'string' ? d.description : 'Payment',
  };
}

/** `SGD 15.00` from cents. */
export function formatAmount(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency,
      currencyDisplay: 'code',
    })
      .format(cents / 100)
      .replace(/\s/g, ' ');
  } catch {
    return `${currency} ${(cents / 100).toFixed(2)}`;
  }
}

export function describeError(error: ExternalModuleReportedError): string {
  return error.source === 'host'
    ? `The payment service could not be loaded (${error.code}).`
    : `The payment service reported a problem: ${error.message}`;
}
