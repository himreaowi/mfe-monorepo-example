/**
 * The staff directory's filters: search text and department. UI state shared by several parts
 * of the feature (StaffFilters changes it, the overview page searches with it). Pure functions:
 * no React, no router, no API calls (staffFiltersReducer.test.ts). The search results are NOT in
 * here: the page loads them with the feature's data hooks (docs/coding-conventions.md "State
 * management").
 *
 * The filters are shareable (a link or a reload must show the same list), so
 * StaffFiltersProvider stores them in the URL (`?q=&department=`): the reducer decides the next
 * filters, `filtersToSearchParams` / `filtersFromSearchParams` map them to and from the URL.
 */
export type StaffFilters = {
  /** Search text (name, job title, department or skill), as typed. */
  q: string;
  /** Department name, or '' for all departments. */
  department: string;
};

export type StaffFiltersAction =
  | { type: 'queryChanged'; q: string }
  | { type: 'departmentChanged'; department: string };

export const initialStaffFilters: StaffFilters = { q: '', department: '' };

export function staffFiltersReducer(
  state: StaffFilters,
  action: StaffFiltersAction,
): StaffFilters {
  switch (action.type) {
    case 'queryChanged':
      return action.q === state.q ? state : { ...state, q: action.q };
    case 'departmentChanged':
      return action.department === state.department
        ? state
        : { ...state, department: action.department };
    default: {
      // a new action type must be handled above (compile error otherwise)
      const unknown: never = action;
      return unknown;
    }
  }
}

/** URL search parameter of each filter. */
export const FILTER_PARAMS = {
  q: 'q',
  department: 'department',
} as const satisfies Record<keyof StaffFilters, string>;

/** The filters a URL describes (missing parameters are empty). */
export function filtersFromSearchParams(params: URLSearchParams): StaffFilters {
  return {
    q: params.get(FILTER_PARAMS.q) ?? '',
    department: params.get(FILTER_PARAMS.department) ?? '',
  };
}

/**
 * `current` with the filters written in: an empty filter leaves the URL (`/staff-directory`,
 * not `?q=&department=`), other parameters stay as they are.
 */
export function filtersToSearchParams(
  filters: StaffFilters,
  current: URLSearchParams,
): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const key of Object.keys(FILTER_PARAMS) as (keyof StaffFilters)[]) {
    if (filters[key]) next.set(FILTER_PARAMS[key], filters[key]);
    else next.delete(FILTER_PARAMS[key]);
  }
  return next;
}
