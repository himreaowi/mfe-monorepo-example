import {
  createHttpClient,
  defineApiRoutes,
  DEFAULT_TIMEOUT_MS,
  HttpClientError,
  isNetworkError,
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
    // "nope" is not JSON
    expect((error as HttpClientError).body).toBeUndefined();
  });

  it('keeps the parsed JSON body of an error response (validation errors)', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        response(
          JSON.stringify({ message: 'Invalid', errors: { name: 'Required' } }),
          { status: 422, statusText: 'Unprocessable Entity' },
        ),
      );
    const http = createHttpClient({ baseUrl: '/api', fetch: fetchMock });
    const error = await http
      .postJson('/items', { name: '' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpClientError);
    expect(error).toMatchObject({
      status: 422,
      body: { message: 'Invalid', errors: { name: 'Required' } },
    });
  });

  it('leaves body undefined for an empty error response', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(response(null, { status: 500 }));
    const http = createHttpClient({ baseUrl: '/api', fetch: fetchMock });
    const error = await http.post('/x').catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 500, body: undefined });
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

  it('sends only what the caller set, like a plain fetch', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(response(null, { status: 204 }));
    const http = createHttpClient({ baseUrl: '/api', fetch: fetchMock });
    await http.post('/ping');
    const [, init] = fetchMock.mock.calls[0];
    expect([...(init.headers as Headers).keys()]).toEqual([]);
    expect(init.body).toBeNull();
  });

  it('lets the caller set Accept and passes other fetch options on', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(response('{}', { status: 200 }));
    const http = createHttpClient({ baseUrl: '/api', fetch: fetchMock });
    await http.request(
      '/x',
      { cache: 'no-store' },
      {
        headers: { Accept: 'text/csv' },
      },
    );
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Headers).get('accept')).toBe('text/csv');
    expect(init.cache).toBe('no-store');
  });

  it('passes a FormData body through untouched', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(response(null, { status: 204 }));
    const http = createHttpClient({ baseUrl: '/api', fetch: fetchMock });
    const form = new FormData();
    form.set('a', '1');
    await http.request('/upload', { method: 'POST', body: form });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBe(form);
    expect((init.headers as Headers).has('content-type')).toBe(false);
  });

  it('request() returns a fetch Response with status, headers and body', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      response('a,b', {
        status: 200,
        headers: { 'Content-Type': 'text/csv' },
      }),
    );
    const http = createHttpClient({ baseUrl: '/api', fetch: fetchMock });
    const res = await http.request('/report');
    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(200);
    expect(res.url).toBe('/api/report');
    expect(res.headers.get('content-type')).toBe('text/csv');
    await expect(res.text()).resolves.toBe('a,b');
  });

  it('resolves undefined for an empty 200 body', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(response('', { status: 200 }));
    const http = createHttpClient({ baseUrl: '/api', fetch: fetchMock });
    await expect(http.getJson('/x')).resolves.toBeUndefined();
  });

  it('honours per-request credentials over the default', async () => {
    const fetchMock = jest.fn().mockResolvedValue(response('{}'));
    const http = createHttpClient({
      baseUrl: '/api',
      credentials: 'include',
      fetch: fetchMock,
    });
    await http.getJson('/x', { credentials: 'omit' });
    expect(fetchMock.mock.calls[0][1].credentials).toBe('omit');
  });

  it('fills in the error url from the request', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(response(null, { status: 503 }));
    const http = createHttpClient({ baseUrl: '/api', fetch: fetchMock });
    await expect(http.getJson('/x')).rejects.toMatchObject({
      status: 503,
      url: '/api/x',
      timedOut: false,
    });
  });

  it('rethrows a failed connection as the TypeError of fetch', async () => {
    const failure = new TypeError('Failed to fetch');
    const http = createHttpClient({
      baseUrl: '/api',
      fetch: jest.fn().mockRejectedValue(failure),
    });
    const error = await http.getJson('/x').catch((e: unknown) => e);
    expect(error).toBe(failure);
    expect(isNetworkError(error)).toBe(true);
  });

  it('rethrows other errors of a custom fetch unchanged', async () => {
    const failure = new Error('instrumentation broke');
    const http = createHttpClient({
      baseUrl: '/api',
      fetch: jest.fn().mockRejectedValue(failure),
    });
    await expect(http.getJson('/x')).rejects.toBe(failure);
  });

  describe('abort', () => {
    /** A fetch that only ends when its signal aborts, like a server that never answers. */
    const hangingFetch = jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(init.signal?.reason),
          );
        }),
    ) as unknown as typeof fetch;

    it('rejects with the AbortError of the signal, never an HttpClientError', async () => {
      const controller = new AbortController();
      const http = createHttpClient({ baseUrl: '/api', fetch: hangingFetch });
      const pending = http
        .getJson('/x', { signal: controller.signal })
        .catch((e: unknown) => e);
      await new Promise((resolve) => setTimeout(resolve, 0));
      controller.abort();
      const error = await pending;
      expect(error).toMatchObject({ name: 'AbortError' });
      expect(error).not.toBeInstanceOf(HttpClientError);
      expect(isNetworkError(error)).toBe(false);
    });

    it('does not call fetch for an already aborted signal', async () => {
      const fetchMock = jest.fn();
      const http = createHttpClient({ baseUrl: '/api', fetch: fetchMock });
      await expect(
        http.getJson('/x', { signal: AbortSignal.abort() }),
      ).rejects.toMatchObject({ name: 'AbortError' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('times out with a clear HttpClientError', async () => {
      const http = createHttpClient({
        baseUrl: '/api',
        timeout: 5,
        fetch: hangingFetch,
      });
      const error = await http.getJson('/slow').catch((e: unknown) => e);
      expect(error).toBeInstanceOf(HttpClientError);
      expect(error).toMatchObject({
        status: 0,
        timedOut: true,
        url: '/api/slow',
        message: 'Request timed out after 5 ms: /api/slow',
      });
      expect(isNetworkError(error)).toBe(true);
    });

    it('takes a timeout per request, and passes 30 s by default', async () => {
      expect(DEFAULT_TIMEOUT_MS).toBe(30_000);
      const http = createHttpClient({ baseUrl: '/api', fetch: hangingFetch });
      await expect(http.getJson('/slow', { timeout: 5 })).rejects.toMatchObject(
        { timedOut: true },
      );
    });
  });

  describe('onUnauthorized', () => {
    it('is called on a 401, and the error is still thrown', async () => {
      const onUnauthorized = jest.fn();
      const http = createHttpClient({
        baseUrl: '/api',
        onUnauthorized,
        fetch: jest
          .fn()
          .mockResolvedValue(response('{"message":"no"}', { status: 401 })),
      });
      const error = await http.getJson('/me').catch((e: unknown) => e);
      expect(error).toMatchObject({ status: 401, body: { message: 'no' } });
      expect(onUnauthorized).toHaveBeenCalledTimes(1);
      expect(onUnauthorized).toHaveBeenCalledWith(error);
    });

    it('is not called for other errors', async () => {
      const onUnauthorized = jest.fn();
      const http = createHttpClient({
        baseUrl: '/api',
        onUnauthorized,
        fetch: jest.fn().mockResolvedValue(response(null, { status: 403 })),
      });
      await expect(http.getJson('/me')).rejects.toMatchObject({ status: 403 });
      expect(onUnauthorized).not.toHaveBeenCalled();
    });
  });

  it('classifies errors: isNetworkError is false for HTTP and parse errors', () => {
    expect(
      isNetworkError(
        new HttpClientError({ status: 500, statusText: '', url: '/x' }),
      ),
    ).toBe(false);
    expect(isNetworkError(new Error('Expected JSON'))).toBe(false);
    expect(isNetworkError(undefined)).toBe(false);
  });
});
