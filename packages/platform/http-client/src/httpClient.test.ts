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

const API = 'https://api.test/api';

/** The `Request` axios gave the fake fetch. */
const sent = (fetchMock: jest.Mock) => fetchMock.mock.calls[0][0] as Request;

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
    const request = sent(fetchMock);
    expect(request.url).toBe('https://api.test/posts/1');
    expect(request.credentials).toBe('same-origin');
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
    expect(fetchMock.mock.calls.map(([request]) => request.url)).toEqual([
      'https://one.test/a',
      'https://two.test/a',
    ]);
  });

  it('POSTs JSON with content type and merged headers', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(response(null, { status: 204 }));
    const http = createHttpClient({
      baseUrl: 'https://api.test/api',
      credentials: 'include',
      headers: { 'X-App': 'shell' },
      fetch: fetchMock,
    });
    await expect(http.postJson('/items', { a: 1 })).resolves.toBeUndefined();
    const request = sent(fetchMock);
    expect(request.url).toBe('https://api.test/api/items');
    expect(request.method).toBe('POST');
    await expect(request.text()).resolves.toBe('{"a":1}');
    expect(request.credentials).toBe('include');
    expect(request.headers.get('content-type')).toBe('application/json');
    expect(request.headers.get('x-app')).toBe('shell');
  });

  it('throws HttpClientError with status on non-2xx', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        response('nope', { status: 404, statusText: 'Not Found' }),
      );
    const http = createHttpClient({
      baseUrl: 'https://api.test/api',
      fetch: fetchMock,
    });
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
    const http = createHttpClient({
      baseUrl: 'https://api.test/api',
      fetch: fetchMock,
    });
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
    const http = createHttpClient({
      baseUrl: 'https://api.test/api',
      fetch: fetchMock,
    });
    const error = await http.post('/x').catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 500, body: undefined });
  });

  it('reports non-JSON bodies clearly', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(response('<html>oops</html>', { status: 200 }));
    const http = createHttpClient({
      baseUrl: 'https://api.test/api',
      fetch: fetchMock,
    });
    await expect(http.getJson('/x')).rejects.toThrow(
      /Expected JSON .* <html>oops/,
    );
  });

  it('adds no Content-Type or User-Agent of its own', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(response(null, { status: 204 }));
    const http = createHttpClient({ baseUrl: API, fetch: fetchMock });
    await http.post('/ping');
    const { headers } = sent(fetchMock);
    expect(headers.has('content-type')).toBe(false);
    expect(headers.has('user-agent')).toBe(false);
  });

  it('sends a FormData body with the boundary of the browser', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(response('{}', { status: 200 }));
    const http = createHttpClient({ baseUrl: API, fetch: fetchMock });
    const form = new FormData();
    form.set('a', '1');
    await http.requestJson('/upload', { method: 'POST', body: form });
    expect(sent(fetchMock).headers.get('content-type')).toMatch(
      /^multipart\/form-data; boundary=/,
    );
  });

  it('resolves undefined for an empty 200 body', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(response('', { status: 200 }));
    const http = createHttpClient({ baseUrl: API, fetch: fetchMock });
    await expect(http.getJson('/x')).resolves.toBeUndefined();
  });

  it.each(['include', 'omit', 'same-origin'] as const)(
    'sends credentials: %s',
    async (credentials) => {
      const fetchMock = jest.fn().mockResolvedValue(response('{}'));
      const http = createHttpClient({ baseUrl: API, fetch: fetchMock });
      await http.getJson('/x', { credentials });
      expect(sent(fetchMock).credentials).toBe(credentials);
    },
  );

  it('fills in the error url from the request', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(response(null, { status: 503 }));
    const http = createHttpClient({ baseUrl: API, fetch: fetchMock });
    await expect(http.getJson('/x')).rejects.toMatchObject({
      status: 503,
      url: `${API}/x`,
      failure: undefined,
    });
  });

  it('maps a failed connection to HttpClientError (network)', async () => {
    const http = createHttpClient({
      baseUrl: API,
      fetch: jest.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    });
    const error = await http.getJson('/x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpClientError);
    expect(error).toMatchObject({
      status: 0,
      failure: 'network',
      message: 'Could not reach the server.',
    });
    expect(isNetworkError(error)).toBe(true);
  });

  describe('abort', () => {
    /** A fetch that only ends when its signal aborts, like a server that never answers. */
    const hangingFetch = ((request: Request) =>
      new Promise<Response>((_resolve, reject) => {
        request.signal.addEventListener('abort', () =>
          reject(request.signal.reason),
        );
      })) as typeof fetch;

    it('rejects with the AbortError of the signal, never an HttpClientError', async () => {
      const controller = new AbortController();
      const http = createHttpClient({ baseUrl: API, fetch: hangingFetch });
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
      const http = createHttpClient({ baseUrl: API, fetch: fetchMock });
      await expect(
        http.getJson('/x', { signal: AbortSignal.abort() }),
      ).rejects.toMatchObject({ name: 'AbortError' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('times out with a clear HttpClientError', async () => {
      const http = createHttpClient({
        baseUrl: API,
        timeout: 5,
        fetch: hangingFetch,
      });
      const error = await http.getJson('/slow').catch((e: unknown) => e);
      expect(error).toBeInstanceOf(HttpClientError);
      expect(error).toMatchObject({
        status: 0,
        failure: 'timeout',
        url: `${API}/slow`,
        message: 'The server took too long to answer.',
      });
      expect(isNetworkError(error)).toBe(true);
    });

    it('takes a timeout per request, and defaults to 30 s', async () => {
      expect(DEFAULT_TIMEOUT_MS).toBe(30_000);
      const http = createHttpClient({ baseUrl: API, fetch: hangingFetch });
      await expect(http.getJson('/slow', { timeout: 5 })).rejects.toMatchObject(
        { failure: 'timeout' },
      );
    });
  });

  describe('onUnauthorized', () => {
    it('is called on a 401, and the error is still thrown', async () => {
      const onUnauthorized = jest.fn();
      const http = createHttpClient({
        baseUrl: API,
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
        baseUrl: API,
        onUnauthorized,
        fetch: jest.fn().mockResolvedValue(response(null, { status: 403 })),
      });
      await expect(http.getJson('/me')).rejects.toMatchObject({ status: 403 });
      expect(onUnauthorized).not.toHaveBeenCalled();
    });
  });

  it('isNetworkError is false for HTTP errors and for bugs', () => {
    expect(
      isNetworkError(
        new HttpClientError({ status: 500, statusText: '', url: '/x' }),
      ),
    ).toBe(false);
    expect(isNetworkError(new TypeError('x is not a function'))).toBe(false);
    expect(isNetworkError(new Error('Expected JSON'))).toBe(false);
    expect(isNetworkError(undefined)).toBe(false);
  });
});
