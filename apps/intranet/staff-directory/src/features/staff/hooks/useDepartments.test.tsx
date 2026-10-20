import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import { getDepartments } from '../api/staffApi';
import { useDepartments } from './useDepartments';

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

describe('useDepartments', () => {
  it('loads the department names', async () => {
    jest.mocked(getDepartments).mockResolvedValue(['Finance', 'Legal']);
    const { result } = renderHook(() => useDepartments(), { wrapper });
    await waitFor(() =>
      expect(result.current).toMatchObject({
        status: 'success',
        data: ['Finance', 'Legal'],
      }),
    );
  });
});
