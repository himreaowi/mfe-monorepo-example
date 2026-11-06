const WEIGHTS = [2, 7, 6, 5, 4, 3, 2];

/** Check letters by the remainder of (weighted sum + offset) mod 11, per series. */
const CHECK_LETTERS: Record<string, { offset: number; letters: string }> = {
  S: { offset: 0, letters: 'JZIHGFEDCBA' },
  T: { offset: 4, letters: 'JZIHGFEDCBA' },
  F: { offset: 0, letters: 'XWUTRQPNMLK' },
  G: { offset: 4, letters: 'XWUTRQPNMLK' },
};

const NRIC_FORMAT = /^[STFGM]\d{7}[A-Z]$/;

/** Surrounding spaces and lower case are not part of the identity: `" s1234567d "` is S1234567D. */
export function normaliseId(value: string): string {
  return value.trim().toUpperCase();
}

/**
 * The check letter that belongs to the series letter and the 7 digits, e.g. `('S', '1234567')`
 * gives `'D'`. Returns `''` for anything that is not a series letter plus 7 digits.
 */
export function nricCheckLetter(series: string, digits: string): string {
  const table = CHECK_LETTERS[series];
  if (!table || !/^\d{7}$/.test(digits)) return '';
  const sum = WEIGHTS.reduce(
    (total, weight, index) => total + weight * Number(digits[index]),
    table.offset,
  );
  return table.letters[sum % 11];
}

/**
 * Is `value` a Singapore NRIC or FIN: a series letter (S or T citizens and PRs, F or G foreign
 * residents, M long-term FIN from 2022), 7 digits and the right check letter?
 *
 * S, T, F and G: format and check letter. M (long-term FIN from 2022): format only (M, 7 digits,
 * a letter), because the M check letters are not verified here. Checks nothing else. It cannot tell whether the number was issued or
 * belongs to the person; the backend must check that and must apply the same rules.
 * Surrounding spaces and lower case are ignored (see `normaliseId`).
 */
export function isValidNric(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const id = normaliseId(value);
  if (!NRIC_FORMAT.test(id)) return false;
  if (id[0] === 'M') return true; // M check letters are not verified: format only
  return nricCheckLetter(id[0], id.slice(1, 8)) === id[8];
}

/**
 * Hide all but the series letter and the last 4 characters: `S1234567D` becomes `S****567D`.
 * Masking an already masked value gives the same value (safe to apply twice).
 * Use it wherever an NRIC is shown; never render the full number. Anything shorter than 5
 * characters is masked completely.
 */
export function maskNric(value: string): string {
  const id = normaliseId(value);
  if (id.length < 5) return '*'.repeat(id.length);
  return `${id[0]}${'*'.repeat(id.length - 5)}${id.slice(-4)}`;
}
