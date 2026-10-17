import { formatFee } from './formatMoney';

describe('formatFee', () => {
  it('formats cents with the currency code, or Free', () => {
    expect(formatFee({ amount: 1500, currency: 'SGD' })).toBe('SGD 15.00');
    expect(formatFee(null)).toBe('Free');
    expect(formatFee({ amount: 100, currency: 'NOPE' })).toBe('NOPE 1.00');
  });
});
