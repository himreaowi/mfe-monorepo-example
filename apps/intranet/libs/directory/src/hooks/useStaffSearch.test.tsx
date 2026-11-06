import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import { API_NOT_CONFIGURED } from '@org/use-api';
import { searchStaff } from '../api/staffApi';
import { ann } from '../__fixtures__/staff';
import { useStaffSearch } from './useStaffSearch';

// Hook tests mock the feature's api/ module: no HTTP here (docs/testing.md).
jest.mock('../api/staffApi');

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

describe('useStaffSearch', () => {
  it('searches with the query, again when it changes', async () => {
    jest
      .mocked(searchStaff)
      .mockResolvedValue({ items: [ann], total: 1, departments: [] });
    const { result, rerender } = renderHook((query) => useStaffSearch(query), {
      wrapper: withSettings({ apiBaseUrl: 'https://api.test/api' }),
      initialProps: { q: '', department: '' },
    });
    await waitFor(() => expect(result.current.status).toBe('success'));
    rerender({ q: 'ann', department: 'Technology' });
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(jest.mocked(searchStaff).mock.calls.map((c) => c[1])).toEqual([
      { q: '', department: '' },
      { q: 'ann', department: 'Technology' },
    ]);
    const [http] = jest.mocked(searchStaff).mock.calls[0];
    expect(http.url('/staff')).toBe('https://api.test/api/staff');
  });

  it('is an error without settings.apiBaseUrl, and calls nothing', async () => {
    const { result } = renderHook(
      () => useStaffSearch({ q: '', department: '' }),
      { wrapper: withSettings({}) },
    );
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current).toMatchObject({
      error: { message: API_NOT_CONFIGURED },
    });
    expect(searchStaff).not.toHaveBeenCalled();
  });
});
