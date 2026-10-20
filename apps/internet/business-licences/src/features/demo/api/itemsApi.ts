import { HttpClientError, type HttpClient } from '@org/http-client';
import { apiRoutes } from '@/core/constants/apiRoutes';
import type { Item, ItemDraft, ItemFieldErrors } from '../types/item';

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

/** Field errors of a 422 response (`{ errors: { name: "…" } }`), if that is what failed. */
export function readFieldErrors(error: unknown): ItemFieldErrors | undefined {
  if (!(error instanceof HttpClientError) || error.status !== 422) {
    return undefined;
  }
  const errors = (error.body as { errors?: unknown } | undefined)?.errors;
  if (!errors || typeof errors !== 'object') return undefined;
  const name = (errors as Record<string, unknown>).name;
  return typeof name === 'string' ? { name } : undefined;
}

/** A message for the UI: operation + status, never a stack trace. */
export function describeError(error: unknown, operation: string): string {
  if (error instanceof HttpClientError) {
    return `${operation} (HTTP ${error.status}). Try again.`;
  }
  return `${operation}. Check your connection and try again.`;
}
