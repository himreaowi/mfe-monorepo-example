import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import {
  StaffFiltersProvider,
  useStaffFilters,
  useStaffFiltersDispatch,
} from './StaffFiltersContext';

function withUrl(url: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[url]}>
        <StaffFiltersProvider>{children}</StaffFiltersProvider>
      </MemoryRouter>
    );
  };
}

function useAll() {
  return {
    filters: useStaffFilters(),
    dispatch: useStaffFiltersDispatch(),
    search: useLocation().search,
    navigate: useNavigate(),
  };
}

describe('StaffFiltersContext', () => {
  it('starts from the URL (a shared link shows the same filters)', () => {
    const { result } = renderHook(() => useStaffFilters(), {
      wrapper: withUrl('/staff?department=Legal&q=ann'),
    });
    expect(result.current).toEqual({ q: 'ann', department: 'Legal' });
  });

  it('dispatch updates the filters and writes them to the URL', () => {
    const { result } = renderHook(useAll, { wrapper: withUrl('/staff') });
    act(() => result.current.dispatch({ type: 'queryChanged', q: 'secu' }));
    expect(result.current.filters).toEqual({ q: 'secu', department: '' });
    expect(result.current.search).toBe('?q=secu');
    act(() =>
      result.current.dispatch({
        type: 'departmentChanged',
        department: 'Technology',
      }),
    );
    expect(result.current.search).toBe('?q=secu&department=Technology');
    act(() => result.current.dispatch({ type: 'queryChanged', q: '' }));
    expect(result.current.search).toBe('?department=Technology');
  });

  it('two dispatches before a render both count', () => {
    const { result } = renderHook(useAll, { wrapper: withUrl('/staff') });
    act(() => {
      result.current.dispatch({ type: 'queryChanged', q: 'ann' });
      result.current.dispatch({ type: 'departmentChanged', department: 'HR' });
    });
    expect(result.current.filters).toEqual({ q: 'ann', department: 'HR' });
  });

  it('follows the URL when it changes elsewhere (back button, a link)', () => {
    const { result } = renderHook(useAll, {
      wrapper: withUrl('/staff?q=ann'),
    });
    act(() => {
      void result.current.navigate('/staff?department=Finance');
    });
    expect(result.current.filters).toEqual({ q: '', department: 'Finance' });
  });

  it('keeps the same dispatch while the filters change', () => {
    const { result } = renderHook(useAll, { wrapper: withUrl('/staff') });
    const first = result.current.dispatch;
    act(() => result.current.dispatch({ type: 'queryChanged', q: 'x' }));
    expect(result.current.dispatch).toBe(first);
  });

  it('throws a clear error outside <StaffFiltersProvider>', () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const router = ({ children }: { children: ReactNode }) => (
      <MemoryRouter>{children}</MemoryRouter>
    );
    expect(() =>
      renderHook(() => useStaffFilters(), { wrapper: router }),
    ).toThrow(/useStaffFilters\(\) must be used inside <StaffFiltersProvider>/);
    expect(() =>
      renderHook(() => useStaffFiltersDispatch(), { wrapper: router }),
    ).toThrow(
      /useStaffFiltersDispatch\(\) must be used inside <StaffFiltersProvider>/,
    );
    jest.mocked(console.error).mockRestore();
  });
});
