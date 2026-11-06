import { useMutation, useQueryClient } from '@tanstack/react-query';
import { requireApiClient } from '@org/http-client';
import { useApiClient } from '@org/mf-runtime/remote';
import { createItem } from '../api/itemsApi';
import { demoKeys } from '../queryKeys';
import type { ItemDraft } from '../types/item';

/**
 * Sends a draft. On success the list is invalidated, so `useItems()` loads it again; returning
 * that promise keeps `isPending` true until the new list is there.
 */
export function useCreateItem() {
  const http = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draft: ItemDraft) => createItem(requireApiClient(http), draft),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: demoKeys.items() }),
  });
}

export type CreateItemMutation = ReturnType<typeof useCreateItem>;
