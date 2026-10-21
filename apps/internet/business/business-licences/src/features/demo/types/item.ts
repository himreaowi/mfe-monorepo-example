/** An item of the example `/items` API (tools/mock-api in development). */
export type Item = {
  id: number;
  name: string;
  description: string;
};

/** What the "Add item" form sends. */
export type ItemDraft = {
  name: string;
};

/** Field → message, from client validation or a server 422 (`errors`). */
export type ItemFieldErrors = Partial<Record<keyof ItemDraft, string>>;

export const ITEM_NAME_MAX_LENGTH = 80;
