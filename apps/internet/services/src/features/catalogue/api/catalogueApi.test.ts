import { createHttpClient } from '@org/http-client';
import { createFakeFetch, type FakeRoute } from '@org/jest-config/fetch';
import { getCategories, getService, listServices } from './catalogueApi';

function fakeHttp(routes: Record<string, FakeRoute>) {
  const fetch = createFakeFetch(routes);
  return {
    http: createHttpClient({ baseUrl: 'https://api.test/api', fetch }),
    fetch,
  };
}

describe('catalogue api', () => {
  it('lists services with query and category', async () => {
    const { http, fetch } = fakeHttp({
      'GET /api/services': {
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
    expect(fetch.calls[0].url).toBe(
      'https://api.test/api/services?q=dog&category=Pets',
    );
  });

  it('reads the categories from the unfiltered list', async () => {
    const { http, fetch } = fakeHttp({
      'GET /api/services': { body: { categories: ['A', 'B'] } },
    });
    await expect(getCategories(http)).resolves.toEqual(['A', 'B']);
    expect(fetch.calls[0].url).toBe('https://api.test/api/services');
  });

  it('returns a service with defaults, null when unknown', async () => {
    const { http } = fakeHttp({
      'GET /api/services/x': { body: { slug: 'x', title: 'X' } },
      'GET /api/services/down': { status: 503 },
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
