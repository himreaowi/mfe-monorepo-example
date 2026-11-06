import { ITEM_NAME_MAX_LENGTH } from '../types/item';
import { validateItemDraft } from './validation';

const UEN = '201912345K';

describe('validateItemDraft', () => {
  it('requires a name (blank or whitespace is rejected)', () => {
    expect(validateItemDraft({ name: '', uen: UEN })).toEqual({
      name: 'Enter a name.',
    });
    expect(validateItemDraft({ name: '   ', uen: UEN })).toEqual({
      name: 'Enter a name.',
    });
  });

  it('limits the length', () => {
    expect(
      validateItemDraft({
        name: 'x'.repeat(ITEM_NAME_MAX_LENGTH + 1),
        uen: UEN,
      }),
    ).toEqual({ name: `Use ${ITEM_NAME_MAX_LENGTH} characters or fewer.` });
  });

  it('requires a UEN', () => {
    expect(validateItemDraft({ name: 'Shop', uen: '  ' })).toEqual({
      uen: 'Enter the UEN.',
    });
  });

  it('rejects a malformed UEN and accepts the common shapes', () => {
    expect(validateItemDraft({ name: 'Shop', uen: '12345' })).toEqual({
      uen: 'Enter a valid UEN, for example 201912345K, 53012345K or T09LL0001B.',
    });
    for (const uen of [
      '201912345K',
      '53012345K',
      'T09LL0001B',
      ' 201912345k ',
    ]) {
      expect(validateItemDraft({ name: 'Shop', uen })).toEqual({});
    }
  });

  it('reports every problem at once', () => {
    expect(Object.keys(validateItemDraft({ name: '', uen: 'x' }))).toEqual([
      'name',
      'uen',
    ]);
  });
});
