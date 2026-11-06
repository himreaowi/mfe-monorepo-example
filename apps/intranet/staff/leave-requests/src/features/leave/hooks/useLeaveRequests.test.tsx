import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import { getLeaveRequests } from '../api/leaveApi';
import { request } from '../__fixtures__/leave';
import { useLeaveRequests } from './useLeaveRequests';

// Hook tests mock the feature's api/ module: no HTTP here (docs/testing.md).
jest.mock('../api/leaveApi');

function wrapper({ children }: { children: ReactNode }) {
  return (
    <HostPropsProvider
      value={{
        embedded: true,
        basePath: '/x',
        settings: { apiBaseUrl: 'https://api.test/api' },
      }}
    >
      {children}
    </HostPropsProvider>
  );
}

beforeEach(() => jest.resetAllMocks());

describe('useLeaveRequests', () => {
  it('reports an error; reload() tries again', async () => {
    jest
      .mocked(getLeaveRequests)
      .mockRejectedValueOnce(new Error('502 Bad Gateway'))
      .mockResolvedValueOnce([request]);
    const { result } = renderHook(() => useLeaveRequests(), { wrapper });
    await waitFor(() =>
      expect(result.current).toMatchObject({
        status: 'error',
        error: { message: '502 Bad Gateway' },
      }),
    );
    act(() => result.current.reload());
    await waitFor(() =>
      expect(result.current).toMatchObject({
        status: 'success',
        data: [request],
      }),
    );
    expect(getLeaveRequests).toHaveBeenCalledTimes(2);
  });
});
