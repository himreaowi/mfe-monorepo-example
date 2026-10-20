import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import { ann } from '@/features/staff/__fixtures__/staff';
import { getDepartments, searchStaff } from '@/features/staff/api/staffApi';
import { OverviewPage } from './OverviewPage';

// The page fetches: mock the feature's api/ module (no HTTP).
jest.mock('@/features/staff/api/staffApi');
const searchMock = jest.mocked(searchStaff);

function Location() {
  return <span data-testid="location">{useLocation().search}</span>;
}

function renderPage(url = '/staff') {
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
                <OverviewPage />
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
  searchMock.mockResolvedValue({ items: [ann], total: 1, departments: [] });
  jest.mocked(getDepartments).mockResolvedValue(['Finance', 'Technology']);
});

describe('OverviewPage', () => {
  it('loads the staff and the departments', async () => {
    renderPage();
    expect(await screen.findByRole('link', { name: 'Ann Lee' })).toBeVisible();
    expect(
      await screen.findByRole('option', { name: 'Technology' }),
    ).toBeInTheDocument();
    expect(searchMock).toHaveBeenCalledWith(
      expect.anything(),
      { q: '', department: '' },
      expect.any(AbortSignal),
    );
  });

  it('searches as you type and keeps the query in the URL', async () => {
    searchMock.mockResolvedValue({ items: [], total: 0, departments: [] });
    renderPage();
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
  });

  it('filters by department from the URL and the select', async () => {
    renderPage('/staff?department=Finance');
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
});
