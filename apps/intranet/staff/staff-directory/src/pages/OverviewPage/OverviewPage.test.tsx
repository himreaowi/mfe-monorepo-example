import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { createFakeFetch } from '@org/jest-config/fetch';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import { ann } from '@/features/staff/__fixtures__/staff';
import { OverviewPage } from './OverviewPage';

// The page fetches through @org/intranet-directory: answer the HTTP calls with a fake fetch.
let items = [ann];
const fakeFetch = createFakeFetch({
  'GET /staff': () => ({
    body: {
      items,
      total: items.length,
      departments: ['Finance', 'Technology'],
    },
  }),
});
/** The `q` and `department` of the last staff search. */
function lastSearch() {
  const query = fakeFetch.calls.at(-1)?.query;
  return {
    q: query?.get('q') ?? '',
    department: query?.get('department') ?? '',
  };
}

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
  items = [ann];
  fakeFetch.calls.length = 0;
  globalThis.fetch = fakeFetch; // jsdom has no fetch
});
afterEach(() => {
  Reflect.deleteProperty(globalThis, 'fetch');
});

describe('OverviewPage', () => {
  it('loads the staff and the departments', async () => {
    renderPage();
    expect(await screen.findByRole('link', { name: 'Ann Lee' })).toBeVisible();
    expect(
      await screen.findByRole('option', { name: 'Technology' }),
    ).toBeInTheDocument();
    expect(lastSearch()).toEqual({ q: '', department: '' });
  });

  it('searches as you type and keeps the query in the URL', async () => {
    items = [];
    renderPage();
    await userEvent.type(
      screen.getByRole('searchbox', { name: 'Search staff' }),
      'secu',
    );
    expect(screen.getByTestId('location')).toHaveTextContent('?q=secu');
    await waitFor(() =>
      expect(lastSearch()).toEqual({ q: 'secu', department: '' }),
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
      expect(lastSearch()).toEqual({ q: '', department: 'Technology' }),
    );
  });
});
