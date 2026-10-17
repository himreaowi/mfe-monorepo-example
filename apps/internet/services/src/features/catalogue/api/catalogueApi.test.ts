import { createHttpClient } from '@org/http-client';
import { getCategories, getService, listServices } from './catalogueApi';

type Reply = { status?: number; body?: unknown };

function fakeHttp(replies: Record<string, Reply>) {
  const fetchFn = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const { status = 200, body } = replies[url] ?? { status: 404 };
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: '',
      url,
      text: async () => (body === undefined ? '' : JSON.stringify(body)),
    } as Response;
  });
  return createHttpClient({ baseUrl: 'https://api.test/api', fetch: fetchFn });
}

describe('catalogue api', () => {
  it('lists services with query and category', async () => {
    const http = fakeHttp({
      'https://api.test/api/services?q=dog&category=Pets': {
        body: { items: [{ slug: 'renew-dog-licence' }], categories: ['Pets'] },
      },
    });
    await expect(
      listServices(http, { q: ' dog ', category: 'Pets' }),
    ).resolves.toEqual({
      items: [{ slug: 'renew-dog-licence' }],
      total: 1,
      categories: ['Pets'],
    });
  });

  it('reads the categories from the unfiltered list', async () => {
    const http = fakeHttp({
      'https://api.test/api/services': { body: { categories: ['A', 'B'] } },
    });
    await expect(getCategories(http)).resolves.toEqual(['A', 'B']);
  });

  it('returns a service with defaults, null when unknown', async () => {
    const http = fakeHttp({
      'https://api.test/api/services/x': { body: { slug: 'x', title: 'X' } },
      'https://api.test/api/services/down': { status: 503 },
    });
    await expect(getService(http, 'x')).resolves.toMatchObject({
      slug: 'x',
      eligibility: [],
      documents: [],
      steps: [],
      fee: null,
    });
    await expect(getService(http, 'missing')).resolves.toBeNull();
    await expect(getService(http, 'down')).rejects.toThrow('503');
  });
});
