import { useCallback } from 'react';
import { useApiClient } from '@org/mf-runtime/remote';
import { createItem, describeError, readFieldErrors } from '../api/itemsApi';
import type { Item, ItemDraft, ItemFieldErrors } from '../types/item';

export type CreateItemResult =
  | { ok: true; item: Item }
  | { ok: false; fieldErrors?: ItemFieldErrors; message: string };

/** Submits a draft; a 422 comes back as `fieldErrors` for the form, anything else as `message`. */
export function useCreateItem() {
  const http = useApiClient();
  return useCallback(
    async (draft: ItemDraft): Promise<CreateItemResult> => {
      if (!http) {
        return {
          ok: false,
          message: 'No API configured (settings.apiBaseUrl).',
        };
      }
      try {
        return { ok: true, item: await createItem(http, draft) };
      } catch (error) {
        const fieldErrors = readFieldErrors(error);
        return fieldErrors
          ? {
              ok: false,
              fieldErrors,
              message: 'Please correct the highlighted field.',
            }
          : {
              ok: false,
              message: describeError(error, 'Could not add the item'),
            };
      }
    },
    [http],
  );
}
