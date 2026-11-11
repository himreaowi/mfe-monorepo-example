import {
  filtersFromSearchParams,
  filtersToSearchParams,
  initialStaffFilters,
  staffFiltersReducer,
} from './staffFiltersReducer';

describe('staffFiltersReducer', () => {
  it('changes the search text and the department', () => {
    const typed = staffFiltersReducer(initialStaffFilters, {
      type: 'queryChanged',
      q: 'secu',
    });
    expect(typed).toEqual({ q: 'secu', department: '' });
    expect(
      staffFiltersReducer(typed, {
        type: 'departmentChanged',
        department: 'Legal',
      }),
    ).toEqual({ q: 'secu', department: 'Legal' });
  });

  it('keeps the search text as typed (spaces included)', () => {
    expect(
      staffFiltersReducer(initialStaffFilters, {
        type: 'queryChanged',
        q: ' ann ',
      }).q,
    ).toBe(' ann ');
  });

  it('returns the same object when nothing changes', () => {
    const state = { q: 'ann', department: 'Legal' };
    expect(staffFiltersReducer(state, { type: 'queryChanged', q: 'ann' })).toBe(
      state,
    );
    expect(
      staffFiltersReducer(state, {
        type: 'departmentChanged',
        department: 'Legal',
      }),
    ).toBe(state);
  });

  it('never mutates the previous state', () => {
    const state = Object.freeze({ q: 'a', department: '' });
    expect(() =>
      staffFiltersReducer(state, { type: 'queryChanged', q: 'ab' }),
    ).not.toThrow();
    expect(state).toEqual({ q: 'a', department: '' });
  });
});

describe('filters in the URL', () => {
  it('reads ?q=&department= (missing = empty)', () => {
    expect(
      filtersFromSearchParams(new URLSearchParams('q=priya&department=Legal')),
    ).toEqual({ q: 'priya', department: 'Legal' });
    expect(filtersFromSearchParams(new URLSearchParams(''))).toEqual(
      initialStaffFilters,
    );
  });

  it('writes the filters, drops empty ones, keeps other parameters', () => {
    const next = filtersToSearchParams(
      { q: 'a b', department: '' },
      new URLSearchParams('department=Legal&tab=2'),
    );
    expect(next.toString()).toBe('tab=2&q=a+b');
  });

  it('round-trips', () => {
    const filters = { q: 'Security & Identity', department: 'Technology' };
    expect(
      filtersFromSearchParams(
        filtersToSearchParams(filters, new URLSearchParams()),
      ),
    ).toEqual(filters);
  });
});
