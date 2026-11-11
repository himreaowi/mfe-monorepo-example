import { act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { API_NOT_CONFIGURED, HttpClientError } from '@org/http-client';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import { renderHookWithQuery } from '@org/query/test';
import { createItem } from '@/api/itemsApi';
import { demoKeys } from './queryKeys';
import { useCreateItem } from './useCreateItem';

jest.mock('@/api/itemsApi', () => ({
  ...jest.requireActual('../api/itemsApi'),
  createItem: jest.fn(),
}));
const createItemMock = jest.mocked(createItem);

function wrapper({ children }: { children: ReactNode }) {
  return (
    <HostPropsProvider
      value={{
        embedded: true,
        basePath: '/x',
        settings: { apiBaseUrl: 'http://api.test/api' },
      }}
    >
      {children}
    </HostPropsProvider>
  );
}

describe('useCreateItem', () => {
  beforeEach(() => createItemMock.mockReset());

  it('returns the created item and invalidates the list', async () => {
    createItemMock.mockResolvedValue({ id: 3, name: 'x', description: '' });
    const { result, queryClient } = renderHookWithQuery(() => useCreateItem(), {
      wrapper,
    });
    queryClient.setQueryData(demoKeys.items(), []);
    await act(async () => {
      await expect(
        result.current.mutateAsync({ name: 'x', uen: '201912345K' }),
      ).resolves.toEqual({
        id: 3,
        name: 'x',
        description: '',
      });
    });
    expect(queryClient.getQueryState(demoKeys.items())?.isInvalidated).toBe(
      true,
    );
  });

  it('rejects with the API error and leaves the list alone', async () => {
    const failure = new HttpClientError(
      { status: 422, statusText: '', url: '/items' },
      { errors: { name: 'Already exists.' } },
    );
    createItemMock.mockRejectedValue(failure);
    const { result, queryClient } = renderHookWithQuery(() => useCreateItem(), {
      wrapper,
    });
    queryClient.setQueryData(demoKeys.items(), []);
    await act(async () => {
      await expect(
        result.current.mutateAsync({ name: 'x', uen: '201912345K' }),
      ).rejects.toBe(failure);
    });
    expect(queryClient.getQueryState(demoKeys.items())?.isInvalidated).toBe(
      false,
    );
  });

  it('reports a missing API instead of calling it', async () => {
    const { result } = renderHookWithQuery(() => useCreateItem());
    await act(async () => {
      await expect(
        result.current.mutateAsync({ name: 'x', uen: '201912345K' }),
      ).rejects.toThrow(API_NOT_CONFIGURED);
    });
    expect(createItemMock).not.toHaveBeenCalled();
  });
});
