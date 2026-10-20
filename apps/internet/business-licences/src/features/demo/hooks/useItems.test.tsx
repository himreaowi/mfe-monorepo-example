import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import { listItems } from '../api/itemsApi';
import { useItems } from './useItems';

// Hook tests mock the feature's api/ module: no HTTP here (docs/testing.md).
jest.mock('../api/itemsApi', () => ({
  ...jest.requireActual('../api/itemsApi'),
  listItems: jest.fn(),
}));
const listItemsMock = jest.mocked(listItems);

function withSettings(settings: Record<string, unknown>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <HostPropsProvider value={{ embedded: true, basePath: '/x', settings }}>
        {children}
      </HostPropsProvider>
    );
  };
}
const api = withSettings({ apiBaseUrl: 'http://api.test/api' });

describe('useItems', () => {
  beforeEach(() => listItemsMock.mockReset());

  it('loads the items (loading → success), add() appends without a refetch', async () => {
    listItemsMock.mockResolvedValue([
      { id: 1, name: 'First', description: '' },
    ]);
    const { result } = renderHook(() => useItems(), { wrapper: api });
    expect(result.current.state).toEqual({ status: 'loading' });
    await waitFor(() => expect(result.current.state.status).toBe('success'));
    act(() => result.current.add({ id: 2, name: 'Second', description: '' }));
    expect(result.current.state).toMatchObject({
      items: [{ id: 1 }, { id: 2 }],
    });
    expect(listItemsMock).toHaveBeenCalledTimes(1);
  });

  it('reports an error; reload() tries again', async () => {
    listItemsMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce([]);
    const { result } = renderHook(() => useItems(), { wrapper: api });
    await waitFor(() => expect(result.current.state.status).toBe('error'));
    expect(result.current.state).toMatchObject({
      message: expect.stringMatching(/Could not load the items/),
    });
    act(() => result.current.reload());
    await waitFor(() =>
      expect(result.current.state).toEqual({ status: 'success', items: [] }),
    );
  });

  it('is "unconfigured" without settings.apiBaseUrl and calls nothing', () => {
    const { result } = renderHook(() => useItems(), {
      wrapper: withSettings({}),
    });
    expect(result.current.state).toEqual({ status: 'unconfigured' });
    expect(listItemsMock).not.toHaveBeenCalled();
  });
});
