import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import type { ApiResult } from '@org/use-api';
import { ann } from '../../__fixtures__/staff';
import { StaffFiltersProvider } from '../../state/StaffFiltersContext';
import type { StaffSearchResult } from '../../types/staff';
import { StaffSearch, type StaffSearchProps } from './StaffSearch';

const reload = jest.fn();
const departments = ['Finance', 'Technology'];
const found = (items = [ann]): ApiResult<StaffSearchResult> => ({
  status: 'success',
  data: { items, total: items.length, departments: [] },
  reload,
});

// A display component: the results come in as props (the page loads them); the filter form
// uses the feature's filter state, so it renders inside the provider (and a router: the URL).
function renderSearch(props: Partial<StaffSearchProps> = {}, url = '/staff') {
  render(
    <MemoryRouter initialEntries={[url]}>
      <HostPropsProvider value={{ embedded: true, basePath: '/staff' }}>
        <StaffFiltersProvider>
          <StaffSearch search={found()} departments={departments} {...props} />
        </StaffFiltersProvider>
      </HostPropsProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => reload.mockReset());

describe('StaffSearch', () => {
  it('lists staff with links below the mount and announces the count', () => {
    renderSearch();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Staff directory' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ann Lee' })).toHaveAttribute(
      'href',
      '/staff/s-1',
    );
    expect(screen.getByTestId('staff-count')).toHaveTextContent(
      '1 person found',
    );
  });

  it('has the filter form with the filters of the URL', () => {
    renderSearch({}, '/staff?q=ann&department=Finance');
    expect(screen.getByRole('searchbox', { name: 'Search staff' })).toHaveValue(
      'ann',
    );
    expect(screen.getByRole('combobox', { name: 'Department' })).toHaveValue(
      'Finance',
    );
  });

  it('shows "Searching…" while loading', () => {
    renderSearch({ search: { status: 'loading', reload } });
    expect(screen.getByTestId('staff-count')).toHaveTextContent('Searching…');
  });

  it('says when no one matches', () => {
    renderSearch({ search: found([]) });
    expect(screen.getByText(/No one matches/)).toBeInTheDocument();
    expect(screen.getByTestId('staff-count')).toHaveTextContent(
      '0 people found',
    );
  });

  it('shows an error with a working "Try again"', async () => {
    renderSearch({
      search: {
        status: 'error',
        error: new Error('503 Service Unavailable'),
        reload,
      },
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      '503 Service Unavailable',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
