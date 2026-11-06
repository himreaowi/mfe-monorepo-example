import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import { dogLicence } from '@/features/catalogue/__fixtures__/services';
import {
  getCategories,
  listServices,
} from '@/features/catalogue/api/catalogueApi';
import { OverviewPage } from './OverviewPage';

// The page fetches: mock the feature's api/ module (no HTTP).
jest.mock('@/features/catalogue/api/catalogueApi');
const listMock = jest.mocked(listServices);

function Location() {
  return <span data-testid="location">{useLocation().search}</span>;
}

function renderPage(url = '/services') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <HostPropsProvider
        value={{
          embedded: true,
          basePath: '/services',
          settings: { apiBaseUrl: 'https://api.test' },
        }}
      >
        <Routes>
          <Route
            path="services/*"
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
  jest
    .mocked(getCategories)
    .mockResolvedValue(['Pets and animals', 'Transport']);
  listMock.mockReset();
  listMock.mockResolvedValue({ items: [dogLicence], total: 1, categories: [] });
});

describe('OverviewPage', () => {
  it('loads the services and topics', async () => {
    renderPage();
    expect(await screen.findByTestId('service-card')).toBeInTheDocument();
    expect(
      await screen.findByRole('option', { name: 'Transport' }),
    ).toBeInTheDocument();
    expect(listMock).toHaveBeenCalledWith(
      expect.anything(),
      { q: '', category: '' },
      expect.any(AbortSignal),
    );
  });

  it('reads the query from the URL, keeps changes there and searches with them', async () => {
    const user = userEvent.setup();
    renderPage('/services?category=Transport');
    await screen.findByRole('option', { name: 'Pets and animals' });
    expect(screen.getByRole('combobox', { name: 'Topic' })).toHaveValue(
      'Transport',
    );
    listMock.mockResolvedValue({ items: [], total: 0, categories: [] });
    await user.type(
      screen.getByRole('searchbox', { name: 'Search services' }),
      'zzz',
    );
    expect(screen.getByTestId('location')).toHaveTextContent(
      '?category=Transport&q=zzz',
    );
    await waitFor(() =>
      expect(listMock).toHaveBeenLastCalledWith(
        expect.anything(),
        { q: 'zzz', category: 'Transport' },
        expect.any(AbortSignal),
      ),
    );
    expect(await screen.findByText(/No services match/)).toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Topic' }),
      '',
    );
    expect(screen.getByTestId('location')).toHaveTextContent('?q=zzz');
  });
});
