import { createHttpClient, HttpClientError } from '@org/http-client';
import { createFakeFetch } from '@org/jest-config/fetch';
import {
  createItem,
  describeError,
  listItems,
  readFieldErrors,
} from './itemsApi';

// API functions run against the real @org/http-client with a fake fetch (docs/testing.md).
function client(routes: Parameters<typeof createFakeFetch>[0]) {
  const fetch = createFakeFetch(routes);
  return {
    fetch,
    http: createHttpClient({ baseUrl: 'http://api.test/api', fetch }),
  };
}

describe('itemsApi', () => {
  it('lists items and normalises them', async () => {
    const { fetch, http } = client({
      'GET /api/items': { body: [{ id: 1, name: 'First' }] },
    });
    await expect(listItems(http)).resolves.toEqual([
      { id: 1, name: 'First', description: '' },
    ]);
    expect(fetch.calls[0].url).toBe('http://api.test/api/items');
  });

  it('rejects an unexpected response shape', async () => {
    const { http } = client({ 'GET /api/items': { body: { items: [] } } });
    await expect(listItems(http)).rejects.toThrow(/expected a list/);
  });

  it('creates an item', async () => {
    const { fetch, http } = client({
      'POST /api/items': ({ body }) => ({
        status: 201,
        body: { id: 4, ...(body as object) },
      }),
    });
    await expect(createItem(http, { name: 'New' })).resolves.toMatchObject({
      id: 4,
      name: 'New',
    });
    expect(fetch.calls[0].body).toEqual({ name: 'New' });
  });

  it('reads 422 field errors, ignores other failures', async () => {
    const { http } = client({
      'POST /api/items': {
        status: 422,
        body: { message: 'Invalid', errors: { name: 'Already exists.' } },
      },
    });
    const error = await createItem(http, { name: 'x' }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(HttpClientError);
    expect(readFieldErrors(error)).toEqual({ name: 'Already exists.' });
    expect(readFieldErrors(new Error('offline'))).toBeUndefined();
  });

  it('describes errors with the operation and status', async () => {
    const { http } = client({ 'GET /api/items': { status: 503 } });
    const error = await listItems(http).catch((e: unknown) => e);
    expect(describeError(error, 'Could not load items')).toBe(
      'Could not load items (HTTP 503). Try again.',
    );
    expect(
      describeError(new TypeError('Failed to fetch'), 'Could not load items'),
    ).toMatch(/Check your connection/);
  });
});
