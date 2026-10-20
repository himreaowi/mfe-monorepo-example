import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import { getStaffMember } from '../api/staffApi';
import { useStaffMember } from './useStaffMember';

// Hook tests mock the feature's api/ module: no HTTP here (docs/testing.md).
jest.mock('../api/staffApi');

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

describe('useStaffMember', () => {
  it('loads the person of the id, from loading again for another id', async () => {
    jest.mocked(getStaffMember).mockResolvedValue(null);
    const { result, rerender } = renderHook(({ id }) => useStaffMember(id), {
      wrapper,
      initialProps: { id: 's-1' },
    });
    await waitFor(() =>
      expect(result.current).toMatchObject({ status: 'success', data: null }),
    );
    rerender({ id: 's-2' });
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(jest.mocked(getStaffMember).mock.calls.map((c) => c[1])).toEqual([
      's-1',
      's-2',
    ]);
  });
});
