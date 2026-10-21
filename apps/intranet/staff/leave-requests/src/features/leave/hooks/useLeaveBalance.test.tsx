import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import { API_NOT_CONFIGURED } from '@org/use-api';
import { getLeaveBalance } from '../api/leaveApi';
import { balances } from '../__fixtures__/leave';
import { useLeaveBalance } from './useLeaveBalance';

// Hook tests mock the feature's api/ module: no HTTP here (docs/testing.md).
jest.mock('../api/leaveApi');

function withSettings(settings: Record<string, unknown>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <HostPropsProvider value={{ embedded: true, basePath: '/x', settings }}>
        {children}
      </HostPropsProvider>
    );
  };
}

beforeEach(() => jest.resetAllMocks());

describe('useLeaveBalance', () => {
  it('loads the balance with the client of settings.apiBaseUrl', async () => {
    jest.mocked(getLeaveBalance).mockResolvedValue(balances);
    const { result } = renderHook(() => useLeaveBalance(), {
      wrapper: withSettings({ apiBaseUrl: 'https://api.test/api' }),
    });
    expect(result.current.status).toBe('loading');
    await waitFor(() =>
      expect(result.current).toMatchObject({
        status: 'success',
        data: balances,
      }),
    );
    const [http] = jest.mocked(getLeaveBalance).mock.calls[0];
    expect(http.url('/leave/balance')).toBe(
      'https://api.test/api/leave/balance',
    );
  });

  it('is an error without settings.apiBaseUrl, and calls nothing', async () => {
    const { result } = renderHook(() => useLeaveBalance(), {
      wrapper: withSettings({}),
    });
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current).toMatchObject({
      error: { message: API_NOT_CONFIGURED },
    });
    expect(getLeaveBalance).not.toHaveBeenCalled();
  });
});
