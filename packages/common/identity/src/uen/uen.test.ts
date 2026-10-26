import { isValidUen } from './uen';

describe('isValidUen', () => {
  it.each([
    ['53012345K', 'business: 8 digits and a letter'],
    ['00000000A', 'business, all zeros'],
    ['201912345K', 'local company: year, 5 digits and a letter'],
    ['199901234Z', 'local company, older year'],
    ['T09LL0001B', 'other entity, T series (limited liability partnership)'],
    ['S99SS1234A', 'other entity, S series'],
    ['R12AB3456C', 'other entity, R series'],
  ])('accepts %s (%s)', (uen) => {
    expect(isValidUen(uen)).toBe(true);
  });

  it('ignores case and surrounding spaces', () => {
    expect(isValidUen(' 201912345k ')).toBe(true);
    expect(isValidUen('t09ll0001b')).toBe(true);
  });

  it.each([
    '',
    '   ',
    '5301234K', // 7 digits
    '2019123456K', // 10 digits
    '53012345', // no letter
    '530123455', // no letter, 9 digits
    '53012345KK',
    'A9912345B', // unknown first letter
    'T09L0001B', // 1 entity-type letter
    'T09LLL0001B',
    'T9LL0001B', // 1-digit year
    'T09LL001B', // 3 digits
    'T09LL00001B', // 5 digits
    'T09LL0001', // no check letter
    '5301-2345K',
    'S1234567D', // an NRIC is not a UEN
  ])('rejects %j', (uen) => {
    expect(isValidUen(uen)).toBe(false);
  });

  it('rejects values that are not strings', () => {
    expect(isValidUen(undefined)).toBe(false);
    expect(isValidUen(null)).toBe(false);
    expect(isValidUen(53012345)).toBe(false);
  });
});
