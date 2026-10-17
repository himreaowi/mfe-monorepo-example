import {
  createHttpClient,
  defineApiRoutes,
  HttpClientError,
  joinUrl,
} from './index';

function response(
  body: string | null,
  init: ResponseInit & { url?: string } = {},
) {
  const res = new Response(body, init);
  Object.defineProperty(res, 'url', {
    value: init.url ?? 'https://api.test/x',
  });
  return res;
}

describe('joinUrl', () => {
  it('joins with exactly one slash', () => {
    expect(joinUrl('https://api.test/', '/posts/1')).toBe(
      'https://api.test/posts/1',
    );
    expect(joinUrl('https://api.test', 'posts/1')).toBe(
      'https://api.test/posts/1',
    );
    expect(joinUrl('/api/', '/posts')).toBe('/api/posts');
  });

  it('returns absolute URLs unchanged', () => {
    expect(joinUrl('https://api.test', 'https://other.test/a')).toBe(
      'https://other.test/a',
    );
  });

  it('fails clearly when the base URL is empty', () => {
    expect(() => joinUrl(' ', '/x')).toThrow(/base URL is empty/);
  });
});

describe('createHttpClient', () => {
  const apiRoutes = defineApiRoutes({
    posts: { byId: (id: number | string) => `/posts/${id}` },
  });

  it('GETs JSON from base URL + apiRoutes path', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(response('{"id":1}', { status: 200 }));
    const http = createHttpClient({
      baseUrl: 'https://api.test/',
      fetch: fetchMock,
    });
    await expect(http.getJson(apiRoutes.posts.byId(1))).resolves.toEqual({
      id: 1,
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.test/posts/1');
    expect(init.credentials).toBe('same-origin');
  });

  it('reads a lazy base URL on every request (runtime config)', async () => {
    let base = 'https://one.test';
    const fetchMock = jest
      .fn()
      .mockImplementation(async () => response('{}', { status: 200 }));
    const http = createHttpClient({ baseUrl: () => base, fetch: fetchMock });
    await http.getJson('/a');
    base = 'https://two.test';
    await http.getJson('/a');
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      'https://one.test/a',
      'https://two.test/a',
    ]);
  });

  it('POSTs JSON with content type and merged headers', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(response(null, { status: 204 }));
    const http = createHttpClient({
      baseUrl: '/api',
      credentials: 'include',
      headers: { 'X-App': 'shell' },
      fetch: fetchMock,
    });
    await expect(http.postJson('/items', { a: 1 })).resolves.toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/items');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"a":1}');
    expect(init.credentials).toBe('include');
    expect((init.headers as Headers).get('content-type')).toBe(
      'application/json',
    );
    expect((init.headers as Headers).get('x-app')).toBe('shell');
  });

  it('throws HttpClientError with status on non-2xx', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        response('nope', { status: 404, statusText: 'Not Found' }),
      );
    const http = createHttpClient({ baseUrl: '/api', fetch: fetchMock });
    const error = await http.getJson('/missing').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpClientError);
    expect(error).toMatchObject({ status: 404, statusText: 'Not Found' });
  });

  it('reports non-JSON bodies clearly', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(response('<html>oops</html>', { status: 200 }));
    const http = createHttpClient({ baseUrl: '/api', fetch: fetchMock });
    await expect(http.getJson('/x')).rejects.toThrow(
      /Expected JSON .* <html>oops/,
    );
  });
});
