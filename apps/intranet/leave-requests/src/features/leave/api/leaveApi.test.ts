import { createHttpClient } from '@org/http-client';
import {
  getLeaveBalance,
  getLeaveRequests,
  LeaveValidationError,
  submitLeaveRequest,
} from './leaveApi';

type Reply = { status: number; body?: unknown };

function fakeHttp(reply: Reply) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchFn = jest.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return {
        ok: reply.status >= 200 && reply.status < 300,
        status: reply.status,
        statusText: '',
        url: String(input),
        text: async () =>
          reply.body === undefined ? '' : JSON.stringify(reply.body),
      } as Response;
    },
  );
  return {
    http: createHttpClient({ baseUrl: 'https://api.test/api', fetch: fetchFn }),
    calls,
  };
}

const input = {
  type: 'annual' as const,
  startDate: '2026-12-21',
  endDate: '2026-12-21',
  reason: '  Dentist ',
};

describe('leave api', () => {
  it('reads balance and requests with defaults for missing fields', async () => {
    await expect(
      getLeaveBalance(fakeHttp({ status: 200, body: { year: 2026 } }).http),
    ).resolves.toEqual({ year: 2026, balances: [] });
    await expect(
      getLeaveRequests(fakeHttp({ status: 200, body: {} }).http),
    ).resolves.toEqual([]);
  });

  it('posts a trimmed request with extra headers', async () => {
    const { http, calls } = fakeHttp({ status: 201, body: { id: 'LR-9' } });
    await expect(
      submitLeaveRequest(http, input, undefined, { 'X-CSRF-Token': 't' }),
    ).resolves.toEqual({ id: 'LR-9' });
    expect(calls[0].url).toBe('https://api.test/api/leave/requests');
    expect(calls[0].init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      ...input,
      reason: 'Dentist',
    });
    expect(new Headers(calls[0].init?.headers).get('x-csrf-token')).toBe('t');
  });

  it('turns a 422 into LeaveValidationError with known fields only', async () => {
    const { http } = fakeHttp({
      status: 422,
      body: {
        errors: { endDate: 'You have 2 days left', evil: '<b>x</b>', type: 3 },
      },
    });
    const error = await submitLeaveRequest(http, input).catch((e) => e);
    expect(error).toBeInstanceOf(LeaveValidationError);
    expect(error.errors).toEqual({ endDate: 'You have 2 days left' });
  });

  it('rethrows other failures', async () => {
    const { http } = fakeHttp({ status: 500 });
    await expect(submitLeaveRequest(http, input)).rejects.toThrow('500');
  });
});
