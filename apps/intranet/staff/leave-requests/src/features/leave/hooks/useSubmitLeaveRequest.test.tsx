import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useAuth } from '@org/auth';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import { API_NOT_CONFIGURED, type SubmitOutcome } from '@org/use-api';
import { submitLeaveRequest } from '../api/leaveApi';
import { request } from '../__fixtures__/leave';
import type { LeaveRequest, LeaveRequestInput } from '../types/leave';
import { useSubmitLeaveRequest } from './useSubmitLeaveRequest';

// Hook tests mock the feature's api/ module: no HTTP here (docs/testing.md).
jest.mock('../api/leaveApi');
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

async function send(
  settings = api,
): Promise<SubmitOutcome<LeaveRequest> | undefined> {
  const { result } = renderHook(() => useSubmitLeaveRequest(), {
    wrapper: settings,
  });
  let outcome: SubmitOutcome<LeaveRequest> | undefined;
  await act(async () => {
    outcome = await result.current.submit(input);
  });
  return outcome;
}

describe('useSubmitLeaveRequest', () => {
  it("POSTs the request with the session's CSRF header", async () => {
    signedIn('csrf-1');
    jest.mocked(submitLeaveRequest).mockResolvedValue(request);
    expect(await send()).toEqual({ ok: true, data: request });
    expect(submitLeaveRequest).toHaveBeenCalledWith(
      expect.anything(),
      input,
      expect.any(AbortSignal),
      { 'X-CSRF-Token': 'csrf-1' },
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
    expect(await send(withSettings({}))).toMatchObject({
      ok: false,
      error: { message: API_NOT_CONFIGURED },
    });
    expect(submitLeaveRequest).not.toHaveBeenCalled();
  });
});
