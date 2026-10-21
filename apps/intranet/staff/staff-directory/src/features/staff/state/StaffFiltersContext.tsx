import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type Dispatch,
  type ReactNode,
} from 'react';
import { useSearchParams } from 'react-router';
import {
  filtersFromSearchParams,
  filtersToSearchParams,
  staffFiltersReducer,
  type StaffFilters,
  type StaffFiltersAction,
} from './staffFiltersReducer';

/*
 * Feature state: React Context + a pure reducer (docs/coding-conventions.md "State
 * management"). State and dispatch are separate contexts, so a component that only dispatches
 * does not re-render when the filters change.
 *
 * The filters are shareable, so the URL is their store (`?q=&department=`): a pasted link, a
 * reload and the back button show the same list, and there is no second copy to keep in sync.
 * `dispatch(action)` runs the reducer on the URL's filters and writes the result back
 * (`replace`: typing does not add history entries). The provider wraps the overview page,
 * inside the remote's router (both modes, embedded and standalone).
 */
const StaffFiltersStateContext = createContext<StaffFilters | null>(null);
StaffFiltersStateContext.displayName = 'StaffFiltersStateContext';
const StaffFiltersDispatchContext =
  createContext<Dispatch<StaffFiltersAction> | null>(null);
StaffFiltersDispatchContext.displayName = 'StaffFiltersDispatchContext';

export function StaffFiltersProvider({ children }: { children: ReactNode }) {
  const [params, setParams] = useSearchParams();
  const { q, department } = filtersFromSearchParams(params);
  const filters = useMemo(() => ({ q, department }), [q, department]);

  // The latest URL for `dispatch`, which stays the same function for the provider's lifetime.
  const latest = useRef({ params, setParams });
  useEffect(() => {
    latest.current = { params, setParams };
  });
  const dispatch = useCallback((action: StaffFiltersAction) => {
    const current = latest.current;
    const before = filtersFromSearchParams(current.params);
    const after = staffFiltersReducer(before, action);
    if (after === before) return;
    const next = filtersToSearchParams(after, current.params);
    // a second dispatch before the next render builds on this one
    latest.current = { ...current, params: next };
    current.setParams(next, { replace: true });
  }, []);

  return (
    <StaffFiltersStateContext.Provider value={filters}>
      <StaffFiltersDispatchContext.Provider value={dispatch}>
        {children}
      </StaffFiltersDispatchContext.Provider>
    </StaffFiltersStateContext.Provider>
  );
}

/** The staff directory's filters (from the URL). Throws outside `<StaffFiltersProvider>`. */
export function useStaffFilters(): StaffFilters {
  const state = useContext(StaffFiltersStateContext);
  if (state === null) {
    throw new Error(
      'useStaffFilters() must be used inside <StaffFiltersProvider> (src/features/staff/state/StaffFiltersContext.tsx). Wrap the page (or the components that use it) in <StaffFiltersProvider>.',
    );
  }
  return state;
}

/**
 * Change the filters (`{ type: 'queryChanged', q }`, `{ type: 'departmentChanged', department }`).
 * Throws outside `<StaffFiltersProvider>`.
 */
export function useStaffFiltersDispatch(): Dispatch<StaffFiltersAction> {
  const dispatch = useContext(StaffFiltersDispatchContext);
  if (dispatch === null) {
    throw new Error(
      'useStaffFiltersDispatch() must be used inside <StaffFiltersProvider> (src/features/staff/state/StaffFiltersContext.tsx). Wrap the page (or the components that use it) in <StaffFiltersProvider>.',
    );
  }
  return dispatch;
}
