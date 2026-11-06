import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { HttpClientError } from '@org/http-client';
import { jsonResponse } from '@org/jest-config/fetch';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import { createItem } from '../api/itemsApi';
import { useCreateItem } from './useCreateItem';

jest.mock('../api/itemsApi', () => ({
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

  it('returns the created item', async () => {
    createItemMock.mockResolvedValue({ id: 3, name: 'x', description: '' });
    const { result } = renderHook(() => useCreateItem(), { wrapper });
    await expect(
      result.current({ name: 'x', uen: '201912345K' }),
    ).resolves.toEqual({
      ok: true,
      item: { id: 3, name: 'x', description: '' },
    });
  });

  it('maps a 422 to field errors and anything else to a message', async () => {
    const { result } = renderHook(() => useCreateItem(), { wrapper });
    createItemMock.mockRejectedValueOnce(
      new HttpClientError(jsonResponse(null, { status: 422 }), {
        errors: { name: 'Already exists.' },
      }),
    );
    await expect(
      result.current({ name: 'x', uen: '201912345K' }),
    ).resolves.toMatchObject({
      ok: false,
      fieldErrors: { name: 'Already exists.' },
    });
    createItemMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(
      result.current({ name: 'x', uen: '201912345K' }),
    ).resolves.toEqual({
      ok: false,
      message: 'Could not add the item. Check your connection and try again.',
    });
  });

  it('reports a missing API instead of calling it', async () => {
    const { result } = renderHook(() => useCreateItem());
    await expect(
      result.current({ name: 'x', uen: '201912345K' }),
    ).resolves.toMatchObject({
      ok: false,
    });
    expect(createItemMock).not.toHaveBeenCalled();
  });
});
