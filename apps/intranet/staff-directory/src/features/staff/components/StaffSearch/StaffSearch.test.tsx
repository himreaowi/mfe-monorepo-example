import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import { getDepartments, searchStaff } from '../../api';
import { ann } from '../../__fixtures__/staff';
import { StaffSearch } from './StaffSearch';

jest.mock('../../api');

const searchMock = jest.mocked(searchStaff);
const departmentsMock = jest.mocked(getDepartments);

function Location() {
  return <span data-testid="location">{useLocation().search}</span>;
}

function renderSearch(url = '/staff') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <HostPropsProvider
        value={{
          embedded: true,
          basePath: '/staff',
          settings: { apiBaseUrl: 'https://api.test' },
        }}
      >
        <Routes>
          <Route
            path="staff/*"
            element={
              <>
                <StaffSearch />
                <Location />
              </>
            }
          />
        </Routes>
      </HostPropsProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  searchMock.mockReset();
  departmentsMock.mockResolvedValue(['Finance', 'Technology']);
});

describe('StaffSearch', () => {
  it('lists staff with links below the mount and announces the count', async () => {
    searchMock.mockResolvedValue({ items: [ann], total: 1, departments: [] });
    renderSearch();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Staff directory' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('link', { name: 'Ann Lee' }),
    ).toHaveAttribute('href', '/staff/s-1');
    expect(screen.getByTestId('staff-count')).toHaveTextContent(
      '1 person found',
    );
  });

  it('searches as you type and keeps the query in the URL', async () => {
    searchMock.mockResolvedValue({ items: [], total: 0, departments: [] });
    renderSearch();
    await userEvent.type(
      screen.getByRole('searchbox', { name: 'Search staff' }),
      'secu',
    );
    expect(screen.getByTestId('location')).toHaveTextContent('?q=secu');
    await waitFor(() =>
      expect(searchMock).toHaveBeenLastCalledWith(
        expect.anything(),
        { q: 'secu', department: '' },
        expect.any(AbortSignal),
      ),
    );
    expect(await screen.findByText(/No one matches/)).toBeInTheDocument();
    expect(screen.getByTestId('staff-count')).toHaveTextContent(
      '0 people found',
    );
  });

  it('filters by department from the URL and the select', async () => {
    searchMock.mockResolvedValue({ items: [ann], total: 1, departments: [] });
    renderSearch('/staff?department=Finance');
    const select = screen.getByRole('combobox', { name: 'Department' });
    await screen.findByRole('option', { name: 'Technology' });
    expect(select).toHaveValue('Finance');
    await userEvent.selectOptions(select, 'Technology');
    expect(screen.getByTestId('location')).toHaveTextContent(
      '?department=Technology',
    );
    await waitFor(() =>
      expect(searchMock).toHaveBeenLastCalledWith(
        expect.anything(),
        { q: '', department: 'Technology' },
        expect.any(AbortSignal),
      ),
    );
  });

  it('shows an error with a working "Try again"', async () => {
    searchMock.mockRejectedValueOnce(new Error('503 Service Unavailable'));
    searchMock.mockResolvedValue({ items: [ann], total: 1, departments: [] });
    renderSearch();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '503 Service Unavailable',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('link', { name: 'Ann Lee' })).toBeVisible();
  });
});
