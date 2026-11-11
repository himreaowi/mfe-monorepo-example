import { describeError, formatAmount, readCompletedPayment } from './payment';

describe('payment event', () => {
  it('accepts a well-formed payment:completed detail', () => {
    expect(
      readCompletedPayment({
        reference: 'BP-20261018-0001',
        amount: 1500,
        currency: 'SGD',
        description: 'Dog licence renewal 2027',
        method: 'paynow',
      }),
    ).toEqual({
      reference: 'BP-20261018-0001',
      amount: 1500,
      currency: 'SGD',
      description: 'Dog licence renewal 2027',
    });
  });

  it('rejects untrusted junk', () => {
    expect(readCompletedPayment(null)).toBeNull();
    expect(
      readCompletedPayment({
        reference: '<img onerror>',
        amount: 1,
        currency: 'SGD',
      }),
    ).toBeNull();
    expect(
      readCompletedPayment({ reference: 'R1', amount: 1.5, currency: 'SGD' }),
    ).toBeNull();
  });

  it('formats amounts and errors', () => {
    expect(formatAmount(1500, 'SGD')).toBe('SGD 15.00');
    expect(
      describeError({ source: 'host', code: 'load-failed', message: 'x' }),
    ).toBe('The payment service could not be loaded (load-failed).');
  });
});
