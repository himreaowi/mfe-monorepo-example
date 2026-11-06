import { isValidUen } from '@org/common-identity';
import {
  ITEM_NAME_MAX_LENGTH,
  type ItemDraft,
  type ItemFieldErrors,
} from '../types/item';

/**
 * Client-side checks, run on submit. The server stays the authority (422): it must apply the
 * same UEN rules (@org/common-identity ships to the browser, anyone can skip it).
 */
export function validateItemDraft(draft: ItemDraft): ItemFieldErrors {
  const errors: ItemFieldErrors = {};
  const name = draft.name.trim();
  if (!name) errors.name = 'Enter a name.';
  else if (name.length > ITEM_NAME_MAX_LENGTH) {
    errors.name = `Use ${ITEM_NAME_MAX_LENGTH} characters or fewer.`;
  }
  const uen = draft.uen.trim();
  if (!uen) errors.uen = 'Enter the UEN.';
  else if (!isValidUen(uen)) {
    errors.uen =
      'Enter a valid UEN, for example 201912345K, 53012345K or T09LL0001B.';
  }
  return errors;
}
