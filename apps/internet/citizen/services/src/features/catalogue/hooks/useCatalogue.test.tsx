import { waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import { API_NOT_CONFIGURED } from '@org/http-client';
import { renderHookWithQuery } from '@org/query/test';
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
    const { result, rerender } = renderHookWithQuery(
      (query) => useServices(query),
      {
        wrapper: api,
        initialProps: { q: '', category: '' },
      },
    );
    await waitFor(() => expect(result.current.status).toBe('success'));
    rerender({ q: 'dog', category: 'Pets and animals' });
    // the previous list stays while the new search loads
    expect(result.current.isPlaceholderData).toBe(true);
    await waitFor(() => expect(result.current.isPlaceholderData).toBe(false));
    expect(jest.mocked(listServices).mock.calls.map((c) => c[1])).toEqual([
      { q: '', category: '' },
      { q: 'dog', category: 'Pets and animals' },
    ]);
    const [http] = jest.mocked(listServices).mock.calls[0];
    expect(http.url('/services')).toBe('https://api.test/api/services');
  });

  it('is an error without settings.apiBaseUrl, and calls nothing', async () => {
    const { result } = renderHookWithQuery(
      () => useServices({ q: '', category: '' }),
      {
        wrapper: withSettings({}),
      },
    );
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
    const { result } = renderHookWithQuery(() => useCategories(), {
      wrapper: api,
    });
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
    const { result } = renderHookWithQuery(() => useService('nope'), {
      wrapper: api,
    });
    await waitFor(() =>
      expect(result.current).toMatchObject({ status: 'success', data: null }),
    );
    expect(jest.mocked(getService).mock.calls[0][1]).toBe('nope');
  });
});
