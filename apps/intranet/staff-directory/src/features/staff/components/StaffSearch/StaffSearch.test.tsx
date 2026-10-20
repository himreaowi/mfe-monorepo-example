import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import type { ApiResult } from '@org/use-api';
import { ann } from '../../__fixtures__/staff';
import type { StaffSearchResult } from '../../types/staff';
import { StaffSearch, type StaffSearchProps } from './StaffSearch';

const reload = jest.fn();
const departments: ApiResult<string[]> = {
  status: 'success',
  data: ['Finance', 'Technology'],
  reload,
};
const found = (items = [ann]): ApiResult<StaffSearchResult> => ({
  status: 'success',
  data: { items, total: items.length, departments: [] },
  reload,
});

// A display component: query, data and callbacks come in as props (the page owns them).
function renderSearch(props: Partial<StaffSearchProps> = {}) {
  const all: StaffSearchProps = {
    query: { q: '', department: '' },
    onQueryChange: jest.fn(),
    search: found(),
    departments,
    ...props,
  };
  render(
    <MemoryRouter>
      <HostPropsProvider value={{ embedded: true, basePath: '/staff' }}>
        <StaffSearch {...all} />
      </HostPropsProvider>
    </MemoryRouter>,
  );
  return all;
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

  it('shows the query and reports changes to the page', async () => {
    const { onQueryChange } = renderSearch({
      query: { q: 'secu', department: 'Finance' },
    });
    expect(screen.getByRole('searchbox', { name: 'Search staff' })).toHaveValue(
      'secu',
    );
    const select = screen.getByRole('combobox', { name: 'Department' });
    expect(select).toHaveValue('Finance');
    await userEvent.type(
      screen.getByRole('searchbox', { name: 'Search staff' }),
      'r',
    );
    expect(onQueryChange).toHaveBeenLastCalledWith('q', 'secur');
    await userEvent.selectOptions(select, 'Technology');
    expect(onQueryChange).toHaveBeenLastCalledWith('department', 'Technology');
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
