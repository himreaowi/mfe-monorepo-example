import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import { getCategories, listServices } from '../../api/catalogueApi';
import { Catalogue } from './Catalogue';
import { dogLicence } from '../../__fixtures__/services';

jest.mock('../../api/catalogueApi');
const listMock = jest.mocked(listServices);

function renderCatalogue(url = '/services') {
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
          <Route path="services/*" element={<Catalogue />} />
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

describe('Catalogue', () => {
  it('shows service cards with fee and channel, linking below the mount', async () => {
    renderCatalogue();
    const card = await screen.findByTestId('service-card');
    expect(
      within(card).getByRole('link', { name: 'Renew a dog licence' }),
    ).toHaveAttribute('href', '/services/renew-dog-licence');
    expect(card).toHaveTextContent('SGD 15.00');
    expect(card).toHaveTextContent('Online');
    expect(screen.getByTestId('service-count')).toHaveTextContent('1 service');
  });

  it('searches and filters by topic', async () => {
    const user = userEvent.setup();
    renderCatalogue('/services?category=Transport');
    await screen.findByRole('option', { name: 'Pets and animals' });
    expect(screen.getByRole('combobox', { name: 'Topic' })).toHaveValue(
      'Transport',
    );
    listMock.mockResolvedValue({ items: [], total: 0, categories: [] });
    await user.type(
      screen.getByRole('searchbox', { name: 'Search services' }),
      'zzz',
    );
    await waitFor(() =>
      expect(listMock).toHaveBeenLastCalledWith(
        expect.anything(),
        { q: 'zzz', category: 'Transport' },
        expect.any(AbortSignal),
      ),
    );
    expect(await screen.findByText(/No services match/)).toBeInTheDocument();
  });
});
