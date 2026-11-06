import { isValidNric, maskNric, nricCheckLetter } from './nric';

describe('isValidNric', () => {
  it.each([
    'S1234567D', // S series
    'S0000001I',
    'T1234567J', // T series (offset 4)
    'F1234567N', // F series
    'G1234567X', // G series (offset 4)
  ])('accepts %s', (id) => {
    expect(isValidNric(id)).toBe(true);
  });

  it('checks only the format of the M series (check letters not verified)', () => {
    expect(isValidNric('M1234567K')).toBe(true);
    expect(isValidNric('M1234567A')).toBe(true);
    expect(isValidNric('M123456A')).toBe(false);
    expect(isValidNric('M12345678')).toBe(false);
  });

  it('ignores case and surrounding spaces', () => {
    expect(isValidNric(' s1234567d ')).toBe(true);
  });

  it('computes the check letter of every series for the same digits', () => {
    expect(
      ['S', 'T', 'F', 'G'].map((s) => nricCheckLetter(s, '1234567')),
    ).toEqual(['D', 'J', 'N', 'X']);
  });

  it('accepts a number made with each series and a computed letter', () => {
    for (const series of ['S', 'T', 'F', 'G']) {
      for (const digits of ['0000000', '9999999', '8512345', '0102030']) {
        expect(
          isValidNric(`${series}${digits}${nricCheckLetter(series, digits)}`),
        ).toBe(true);
      }
    }
  });

  it('rejects a wrong check letter', () => {
    expect(isValidNric('S1234567A')).toBe(false);
    expect(isValidNric('T1234567D')).toBe(false); // T uses another offset than S
    expect(isValidNric('F1234567D')).toBe(false); // F uses another table than S
  });

  it.each([
    '',
    'S123456D', // 6 digits
    'S12345678D', // 8 digits
    'A1234567D', // unknown series
    'S1234567', // no letter
    'S1234567DD',
    '1234567D',
    'S12345 67D',
    'S1234567-',
    'S12A4567D',
  ])('rejects the wrong shape %j', (id) => {
    expect(isValidNric(id)).toBe(false);
  });

  it('rejects values that are not strings', () => {
    expect(isValidNric(undefined)).toBe(false);
    expect(isValidNric(null)).toBe(false);
    expect(isValidNric(1234567)).toBe(false);
    expect(isValidNric({})).toBe(false);
  });
});

describe('nricCheckLetter', () => {
  it('returns an empty string for an unknown series or bad digits', () => {
    expect(nricCheckLetter('A', '1234567')).toBe('');
    expect(nricCheckLetter('M', '1234567')).toBe('');
    expect(nricCheckLetter('S', '123')).toBe('');
  });
});

describe('maskNric', () => {
  it('keeps the first character and the last 4', () => {
    expect(maskNric('S1234567D')).toBe('S****567D');
    expect(maskNric('t7654321j')).toBe('T****321J');
  });

  it('never reveals the digits in between', () => {
    const masked = maskNric('S1234567D');
    expect(masked).not.toContain('1234');
    expect(masked).toHaveLength(9);
  });

  it('is idempotent: an already masked value stays the same', () => {
    expect(maskNric('S****567D')).toBe('S****567D');
    expect(maskNric(maskNric('S1234567D'))).toBe('S****567D');
  });

  it('masks short or odd values without throwing', () => {
    expect(maskNric('')).toBe('');
    expect(maskNric('S12')).toBe('***');
    expect(maskNric('S1234')).toBe('S1234');
    expect(maskNric('S12345')).toBe('S*2345');
  });
});
