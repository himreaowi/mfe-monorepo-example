import { act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useAuth } from '@org/auth';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import { API_NOT_CONFIGURED } from '@org/http-client';
import { renderHookWithQuery } from '@org/query/test';
import { submitLeaveRequest } from '@/api/leaveApi';
import { leaveKeys } from './queryKeys';
import { request } from '@/__fixtures__/leave';
import type { LeaveRequestInput } from '@/types/leave';
import { useSubmitLeaveRequest } from './useSubmitLeaveRequest';

// Hook tests mock the feature's api/ module: no HTTP here (docs/testing.md).
jest.mock('@/api/leaveApi');
jest.mock('@org/auth', () => ({ useAuth: jest.fn() }));

function withSettings(settings: Record<string, unknown>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <HostPropsProvider value={{ embedded: true, basePath: '/x', settings }}>
        {children}
      </HostPropsProvider>
    );
  };
}
const api = withSettings({ apiBaseUrl: 'https://api.test/api' });

const input: LeaveRequestInput = {
  type: 'unpaid',
  startDate: '2026-11-02',
  endDate: '2026-11-02',
  reason: 'Moving',
};

function signedIn(csrfToken: string | null) {
  jest.mocked(useAuth).mockReturnValue({
    csrfToken,
    csrfHeaderName: 'X-CSRF-Token',
  } as unknown as ReturnType<typeof useAuth>);
}

beforeEach(() => jest.resetAllMocks());

async function send(settings = api) {
  const { result, queryClient } = renderHookWithQuery(
    () => useSubmitLeaveRequest(),
    { wrapper: settings },
  );
  queryClient.setQueryData(leaveKeys.requests(), []);
  queryClient.setQueryData(leaveKeys.balance(), {});
  const outcome = await act(async () =>
    result.current.mutateAsync(input).then(
      (data) => ({ ok: true as const, data }),
      (error: Error) => ({ ok: false as const, error }),
    ),
  );
  return { outcome, queryClient };
}

describe('useSubmitLeaveRequest', () => {
  it("POSTs the request with the session's CSRF header", async () => {
    signedIn('csrf-1');
    jest.mocked(submitLeaveRequest).mockResolvedValue(request);
    const { outcome, queryClient } = await send();
    expect(outcome).toEqual({ ok: true, data: request });
    expect(submitLeaveRequest).toHaveBeenCalledWith(
      expect.anything(),
      input,
      undefined,
      { 'X-CSRF-Token': 'csrf-1' },
    );
    // the new request uses up days: balance and list are loaded again
    expect(queryClient.getQueryState(leaveKeys.requests())?.isInvalidated).toBe(
      true,
    );
    expect(queryClient.getQueryState(leaveKeys.balance())?.isInvalidated).toBe(
      true,
    );
  });

  it('sends no CSRF header without a session token', async () => {
    signedIn(null);
    jest.mocked(submitLeaveRequest).mockResolvedValue(request);
    await send();
    expect(jest.mocked(submitLeaveRequest).mock.calls[0][3]).toBeUndefined();
  });

  it('fails without settings.apiBaseUrl, and sends nothing', async () => {
    signedIn('csrf-1');
    const { outcome, queryClient } = await send(withSettings({}));
    expect(outcome).toMatchObject({
      ok: false,
      error: { message: API_NOT_CONFIGURED },
    });
    expect(queryClient.getQueryState(leaveKeys.requests())?.isInvalidated).toBe(
      false,
    );
    expect(submitLeaveRequest).not.toHaveBeenCalled();
  });
});
