import { waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import { API_NOT_CONFIGURED } from '@org/http-client';
import { renderHookWithQuery } from '@org/query/test';
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
    const { result, rerender } = renderHookWithQuery(
      (query) => useStaffSearch(query),
      {
        wrapper: withSettings({ apiBaseUrl: 'https://api.test/api' }),
        initialProps: { q: '', department: '' },
      },
    );
    await waitFor(() => expect(result.current.status).toBe('success'));
    rerender({ q: 'ann', department: 'Technology' });
    // the previous list stays while the new search loads
    expect(result.current.status).toBe('success');
    expect(result.current.isPlaceholderData).toBe(true);
    await waitFor(() => expect(result.current.isPlaceholderData).toBe(false));
    expect(jest.mocked(searchStaff).mock.calls.map((c) => c[1])).toEqual([
      { q: '', department: '' },
      { q: 'ann', department: 'Technology' },
    ]);
    const [http] = jest.mocked(searchStaff).mock.calls[0];
    expect(http.url('/staff')).toBe('https://api.test/api/staff');
  });

  it('waits while disabled: no request, still pending', () => {
    const { result } = renderHookWithQuery(
      () => useStaffSearch({ q: 'a', department: '' }, { enabled: false }),
      { wrapper: withSettings({ apiBaseUrl: 'https://api.test/api' }) },
    );
    expect(result.current.status).toBe('pending');
    expect(searchStaff).not.toHaveBeenCalled();
  });

  it('is an error without settings.apiBaseUrl, and calls nothing', async () => {
    const { result } = renderHookWithQuery(
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
