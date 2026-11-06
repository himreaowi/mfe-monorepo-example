import type { HttpClient } from '@org/http-client';
import { apiRoutes } from '@/core/constants/apiRoutes';
import type { Item, ItemDraft } from '../types/item';

/** Pure request functions: no React, no state. Responses are validated and normalised here. */

function toItem(value: unknown): Item {
  const raw = (value ?? {}) as Record<string, unknown>;
  if (typeof raw.id !== 'number' || typeof raw.name !== 'string') {
    throw new Error('Unexpected item in the API response.');
  }
  return {
    id: raw.id,
    name: raw.name,
    description: typeof raw.description === 'string' ? raw.description : '',
    ...(typeof raw.uen === 'string' ? { uen: raw.uen } : {}),
  };
}

export async function listItems(
  http: HttpClient,
  signal?: AbortSignal,
): Promise<Item[]> {
  const data = await http.getJson<unknown>(apiRoutes.items.list(), { signal });
  if (!Array.isArray(data)) {
    throw new Error('Unexpected response: expected a list of items.');
  }
  return data.map(toItem);
}

export async function createItem(
  http: HttpClient,
  draft: ItemDraft,
): Promise<Item> {
  return toItem(await http.postJson<unknown>(apiRoutes.items.list(), draft));
}
