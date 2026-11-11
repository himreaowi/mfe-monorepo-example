import { act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useAuth } from '@org/auth';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import { API_NOT_CONFIGURED } from '@org/http-client';
import { renderHookWithQuery } from '@org/query/test';
import { getProfile, updatePreferences } from '@/api/profileApi';
import { profile } from '@/__fixtures__/profile';
import { profileKeys } from './queryKeys';
import { useProfile, useSavePreferences } from './useProfile';

// Hook tests mock the feature's api/ module: no HTTP here (docs/testing.md).
jest.mock('@/api/profileApi');
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

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(useAuth).mockReturnValue({
    csrfToken: 'csrf-1',
    csrfHeaderName: 'X-CSRF-Token',
  } as unknown as ReturnType<typeof useAuth>);
});

describe('useProfile', () => {
  it('loads the profile with the client of settings.apiBaseUrl', async () => {
    jest.mocked(getProfile).mockResolvedValue(profile);
    const { result } = renderHookWithQuery(() => useProfile(), {
      wrapper: api,
    });
    await waitFor(() =>
      expect(result.current).toMatchObject({
        status: 'success',
        data: profile,
      }),
    );
    const [http] = jest.mocked(getProfile).mock.calls[0];
    expect(http.url('/profile/me')).toBe('https://api.test/api/profile/me');
  });

  it('is an error without settings.apiBaseUrl, and calls nothing', async () => {
    const { result } = renderHookWithQuery(() => useProfile(), {
      wrapper: withSettings({}),
    });
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current).toMatchObject({
      error: { message: API_NOT_CONFIGURED },
    });
    expect(getProfile).not.toHaveBeenCalled();
  });
});

describe('useSavePreferences', () => {
  it('PUTs the choices with the CSRF header', async () => {
    jest.mocked(updatePreferences).mockResolvedValue(profile);
    const { result, queryClient } = renderHookWithQuery(
      () => useSavePreferences(),
      { wrapper: api },
    );
    queryClient.setQueryData(profileKeys.me(), profile);
    await act(async () => {
      await expect(
        result.current.mutateAsync({ emailUpdates: true, smsReminders: true }),
      ).resolves.toEqual(profile);
    });
    // the saved choices come from the server again
    expect(queryClient.getQueryState(profileKeys.me())?.isInvalidated).toBe(
      true,
    );
    expect(updatePreferences).toHaveBeenCalledWith(
      expect.anything(),
      { emailUpdates: true, smsReminders: true },
      { 'X-CSRF-Token': 'csrf-1' },
    );
  });
});
