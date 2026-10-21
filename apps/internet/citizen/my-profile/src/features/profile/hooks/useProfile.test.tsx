import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useAuth } from '@org/auth';
import { HttpClientError } from '@org/http-client';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import { API_NOT_CONFIGURED } from '@org/use-api';
import { getProfile, updatePreferences } from '../api/profileApi';
import { profile } from '../__fixtures__/profile';
import { useProfile, useSavePreferences } from './useProfile';

// Hook tests mock the feature's api/ module: no HTTP here (docs/testing.md).
jest.mock('../api/profileApi');
jest.mock('@org/auth', () => ({ useAuth: jest.fn() }));

const refresh = jest.fn();

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

const unauthorized = () =>
  new HttpClientError({
    status: 401,
    statusText: 'Unauthorized',
    url: 'https://api.test/api/profile/me',
  } as Response);

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(useAuth).mockReturnValue({
    csrfToken: 'csrf-1',
    csrfHeaderName: 'X-CSRF-Token',
    refresh,
  } as unknown as ReturnType<typeof useAuth>);
});

describe('useProfile', () => {
  it('loads the profile with the client of settings.apiBaseUrl', async () => {
    jest.mocked(getProfile).mockResolvedValue(profile);
    const { result } = renderHook(() => useProfile(), { wrapper: api });
    await waitFor(() =>
      expect(result.current).toMatchObject({
        status: 'success',
        data: profile,
      }),
    );
    const [http] = jest.mocked(getProfile).mock.calls[0];
    expect(http.url('/profile/me')).toBe('https://api.test/api/profile/me');
  });

  it('asks the shell to re-check the session after a 401', async () => {
    jest.mocked(getProfile).mockRejectedValue(unauthorized());
    const { result } = renderHook(() => useProfile(), { wrapper: api });
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(refresh).toHaveBeenCalled();
  });

  it('is an error without settings.apiBaseUrl, and calls nothing', async () => {
    const { result } = renderHook(() => useProfile(), {
      wrapper: withSettings({}),
    });
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current).toMatchObject({
      error: { message: API_NOT_CONFIGURED },
    });
    expect(getProfile).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('useSavePreferences', () => {
  it('PUTs the choices with the CSRF header', async () => {
    jest.mocked(updatePreferences).mockResolvedValue(profile);
    const { result } = renderHook(() => useSavePreferences(), {
      wrapper: api,
    });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.submit({
        emailUpdates: true,
        smsReminders: true,
      });
    });
    expect(outcome).toEqual({ ok: true, data: profile });
    expect(updatePreferences).toHaveBeenCalledWith(
      expect.anything(),
      { emailUpdates: true, smsReminders: true },
      { 'X-CSRF-Token': 'csrf-1' },
      expect.any(AbortSignal),
    );
  });

  it('re-checks the session after a 401', async () => {
    jest.mocked(updatePreferences).mockRejectedValue(unauthorized());
    const { result } = renderHook(() => useSavePreferences(), {
      wrapper: api,
    });
    await act(async () => {
      await result.current.submit(profile.preferences);
    });
    expect(result.current.state.status).toBe('error');
    expect(refresh).toHaveBeenCalled();
  });
});
