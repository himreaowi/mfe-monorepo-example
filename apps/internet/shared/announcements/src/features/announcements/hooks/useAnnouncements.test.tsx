import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import { API_NOT_CONFIGURED } from '@org/use-api';
import { getAnnouncement, listAnnouncements } from '../api/announcementsApi';
import { maintenance } from '../__fixtures__/announcements';
import { useAnnouncement, useAnnouncements } from './useAnnouncements';

// Hook tests mock the feature's api/ module: no HTTP here (docs/testing.md).
jest.mock('../api/announcementsApi');

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

beforeEach(() => jest.resetAllMocks());

describe('useAnnouncements', () => {
  it('loads the list with the client of settings.apiBaseUrl', async () => {
    jest.mocked(listAnnouncements).mockResolvedValue([maintenance]);
    const { result } = renderHook(() => useAnnouncements(), { wrapper: api });
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current).toMatchObject({ data: [maintenance] });
    const [http] = jest.mocked(listAnnouncements).mock.calls[0];
    expect(http.url('/announcements')).toBe(
      'https://api.test/api/announcements',
    );
  });

  it('is an error without settings.apiBaseUrl, and calls nothing', async () => {
    const { result } = renderHook(() => useAnnouncements(), {
      wrapper: withSettings({}),
    });
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current).toMatchObject({
      error: { message: API_NOT_CONFIGURED },
    });
    expect(listAnnouncements).not.toHaveBeenCalled();
  });
});

describe('useAnnouncement', () => {
  it('loads one announcement by id and again for another id', async () => {
    jest.mocked(getAnnouncement).mockResolvedValue(maintenance);
    const { result, rerender } = renderHook(({ id }) => useAnnouncement(id), {
      wrapper: api,
      initialProps: { id: 'a-2026-031' },
    });
    await waitFor(() => expect(result.current.status).toBe('success'));
    jest.mocked(getAnnouncement).mockResolvedValue(null);
    rerender({ id: 'gone' });
    expect(result.current.status).toBe('loading');
    await waitFor(() =>
      expect(result.current).toMatchObject({ status: 'success', data: null }),
    );
    expect(jest.mocked(getAnnouncement).mock.calls.map((c) => c[1])).toEqual([
      'a-2026-031',
      'gone',
    ]);
  });
});
