import { createHttpClient } from '@org/http-client';
import { createFakeFetch, type FakeRoute } from '@org/jest-config/fetch';
import {
  getLeaveBalance,
  getLeaveRequests,
  LeaveValidationError,
  submitLeaveRequest,
} from './leaveApi';

function fakeHttp(routes: Record<string, FakeRoute>) {
  const fetch = createFakeFetch(routes);
  return {
    http: createHttpClient({ baseUrl: 'https://api.test/api', fetch }),
    fetch,
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
    const { http } = fakeHttp({
      'GET /api/leave/balance': { body: { year: 2026 } },
      'GET /api/leave/requests': { body: {} },
    });
    await expect(getLeaveBalance(http)).resolves.toEqual({
      year: 2026,
      balances: [],
    });
    await expect(getLeaveRequests(http)).resolves.toEqual([]);
  });

  it('posts a trimmed request with extra headers', async () => {
    const { http, fetch } = fakeHttp({
      'POST /api/leave/requests': { status: 201, body: { id: 'LR-9' } },
    });
    await expect(
      submitLeaveRequest(http, input, undefined, { 'X-CSRF-Token': 't' }),
    ).resolves.toEqual({ id: 'LR-9' });
    const [call] = fetch.calls;
    expect(call.url).toBe('https://api.test/api/leave/requests');
    expect(call.method).toBe('POST');
    expect(call.body).toEqual({ ...input, reason: 'Dentist' });
    expect(new Headers(call.init.headers).get('x-csrf-token')).toBe('t');
  });

  it('turns a 422 into LeaveValidationError with known fields only', async () => {
    const { http } = fakeHttp({
      'POST /api/leave/requests': {
        status: 422,
        body: {
          errors: {
            endDate: 'You have 2 days left',
            evil: '<b>x</b>',
            type: 3,
          },
        },
      },
    });
    const error = await submitLeaveRequest(http, input).catch((e) => e);
    expect(error).toBeInstanceOf(LeaveValidationError);
    expect(error.errors).toEqual({ endDate: 'You have 2 days left' });
  });

  it('rethrows other failures', async () => {
    const { http } = fakeHttp({ 'POST /api/leave/requests': { status: 500 } });
    await expect(submitLeaveRequest(http, input)).rejects.toThrow('500');
  });
});
