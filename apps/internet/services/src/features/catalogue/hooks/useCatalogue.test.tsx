import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import { API_NOT_CONFIGURED } from '@org/use-api';
import { getCategories, getService, listServices } from '../api/catalogueApi';
import { dogLicence } from '../__fixtures__/services';
import { useCategories, useService, useServices } from './useCatalogue';

// Hook tests mock the feature's api/ module: no HTTP here (docs/testing.md).
jest.mock('../api/catalogueApi');

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

describe('useServices', () => {
  it('loads with the query and again when it changes', async () => {
    jest
      .mocked(listServices)
      .mockResolvedValue({ items: [dogLicence], total: 1, categories: [] });
    const { result, rerender } = renderHook((query) => useServices(query), {
      wrapper: api,
      initialProps: { q: '', category: '' },
    });
    await waitFor(() => expect(result.current.status).toBe('success'));
    rerender({ q: 'dog', category: 'Pets and animals' });
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(jest.mocked(listServices).mock.calls.map((c) => c[1])).toEqual([
      { q: '', category: '' },
      { q: 'dog', category: 'Pets and animals' },
    ]);
    const [http] = jest.mocked(listServices).mock.calls[0];
    expect(http.url('/services')).toBe('https://api.test/api/services');
  });

  it('is an error without settings.apiBaseUrl, and calls nothing', async () => {
    const { result } = renderHook(() => useServices({ q: '', category: '' }), {
      wrapper: withSettings({}),
    });
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current).toMatchObject({
      error: { message: API_NOT_CONFIGURED },
    });
    expect(listServices).not.toHaveBeenCalled();
  });
});

describe('useCategories', () => {
  it('loads the topics', async () => {
    jest.mocked(getCategories).mockResolvedValue(['Transport']);
    const { result } = renderHook(() => useCategories(), { wrapper: api });
    await waitFor(() =>
      expect(result.current).toMatchObject({
        status: 'success',
        data: ['Transport'],
      }),
    );
  });
});

describe('useService', () => {
  it('loads one service by slug (null when unknown)', async () => {
    jest.mocked(getService).mockResolvedValue(null);
    const { result } = renderHook(() => useService('nope'), { wrapper: api });
    await waitFor(() =>
      expect(result.current).toMatchObject({ status: 'success', data: null }),
    );
    expect(jest.mocked(getService).mock.calls[0][1]).toBe('nope');
  });
});
