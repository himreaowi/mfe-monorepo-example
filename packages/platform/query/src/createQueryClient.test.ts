import { HttpClientError } from '@org/http-client';
import { createQueryClient, shouldRetryQuery } from './index';

const httpError = (status: number) =>
  new HttpClientError({ status, statusText: '', url: '/x' });

describe('createQueryClient', () => {
  it('sets the shared defaults', () => {
    const { queries, mutations } = createQueryClient().getDefaultOptions();
    expect(queries).toMatchObject({
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: shouldRetryQuery,
    });
    expect(mutations).toEqual({ retry: false });
  });

  it('retries a 5xx once, end to end', async () => {
    const client = createQueryClient();
    const queryFn = jest
      .fn()
      .mockRejectedValueOnce(httpError(503))
      .mockResolvedValueOnce('ok');
    await expect(
      client.fetchQuery({ queryKey: ['x'], queryFn, retryDelay: 0 }),
    ).resolves.toBe('ok');
    expect(queryFn).toHaveBeenCalledTimes(2);
  });
});

describe('shouldRetryQuery', () => {
  it('retries network errors, timeouts and 5xx once', () => {
    const timeout = new HttpClientError(
      { status: 0, statusText: 'Timeout', url: '/x' },
      undefined,
      10,
    );
    for (const error of [
      new TypeError('Failed to fetch'),
      timeout,
      httpError(500),
      httpError(503),
    ]) {
      expect(shouldRetryQuery(0, error)).toBe(true);
      expect(shouldRetryQuery(1, error)).toBe(false);
    }
  });

  it('never retries 4xx, aborts or anything else', () => {
    for (const error of [
      httpError(400),
      httpError(401),
      httpError(404),
      httpError(422),
      new DOMException('Aborted', 'AbortError'),
      new Error('Expected JSON from /x, got: <html>'),
      undefined,
    ]) {
      expect(shouldRetryQuery(0, error)).toBe(false);
    }
  });
});
