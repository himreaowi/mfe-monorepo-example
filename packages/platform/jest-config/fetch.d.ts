export interface FakeFetchCall {
  url: string;
  method: string;
  pathname: string;
  query: URLSearchParams;
  /** Request body, JSON-parsed when it is a JSON string. */
  body: unknown;
  init: RequestInit;
}

export type FakeRouteResult =
  | Response
  | { status?: number; body?: unknown; headers?: Record<string, string> };

export type FakeRoute =
  | FakeRouteResult
  | ((call: FakeFetchCall) => FakeRouteResult | Promise<FakeRouteResult>);

export type FakeFetch = typeof fetch & { calls: FakeFetchCall[] };

/** A `fetch` answering from `routes` (`"GET /api/items"` → result) and recording `calls`. */
export declare function createFakeFetch(
  routes?: Record<string, FakeRoute>,
): FakeFetch;

/** A JSON `Response` (null body for 204/304 or `undefined`). */
export declare function jsonResponse(
  body: unknown,
  init?: {
    status?: number;
    statusText?: string;
    headers?: Record<string, string>;
    url?: string;
  },
): Response;
