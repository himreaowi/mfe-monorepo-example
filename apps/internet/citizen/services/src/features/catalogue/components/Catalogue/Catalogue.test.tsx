import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import type { ApiResult } from '@org/use-api';
import { dogLicence } from '../../__fixtures__/services';
import type { CatalogueResult } from '../../types/service';
import { Catalogue, type CatalogueProps } from './Catalogue';

const reload = jest.fn();
const topics: ApiResult<string[]> = {
  status: 'success',
  data: ['Pets and animals', 'Transport'],
  reload,
};
const oneService: ApiResult<CatalogueResult> = {
  status: 'success',
  data: { items: [dogLicence], total: 1, categories: [] },
  reload,
};

// A display component: query, data and callbacks come in as props (the page owns them).
function renderCatalogue(props: Partial<CatalogueProps> = {}) {
  const all: CatalogueProps = {
    query: { q: '', category: '' },
    onQueryChange: jest.fn(),
    services: oneService,
    categories: topics,
    ...props,
  };
  render(
    <MemoryRouter>
      <HostPropsProvider value={{ embedded: true, basePath: '/services' }}>
        <Catalogue {...all} />
      </HostPropsProvider>
    </MemoryRouter>,
  );
  return all;
}

beforeEach(() => reload.mockReset());

describe('Catalogue', () => {
  it('shows service cards with fee and channel, linking below the mount', () => {
    renderCatalogue();
    const card = screen.getByTestId('service-card');
    expect(
      within(card).getByRole('link', { name: 'Renew a dog licence' }),
    ).toHaveAttribute('href', '/services/renew-dog-licence');
    expect(card).toHaveTextContent('SGD 15.00');
    expect(card).toHaveTextContent('Online');
    expect(screen.getByTestId('service-count')).toHaveTextContent('1 service');
  });

  it('shows the query and reports changes to the page', async () => {
    const { onQueryChange } = renderCatalogue({
      query: { q: 'dog', category: 'Transport' },
    });
    expect(
      screen.getByRole('searchbox', { name: 'Search services' }),
    ).toHaveValue('dog');
    const topic = screen.getByRole('combobox', { name: 'Topic' });
    expect(topic).toHaveValue('Transport');
    await userEvent.type(
      screen.getByRole('searchbox', { name: 'Search services' }),
      's',
    );
    expect(onQueryChange).toHaveBeenLastCalledWith('q', 'dogs');
    await userEvent.selectOptions(topic, 'Pets and animals');
    expect(onQueryChange).toHaveBeenLastCalledWith(
      'category',
      'Pets and animals',
    );
  });

  it('shows "Searching…" while the services load', () => {
    renderCatalogue({ services: { status: 'loading', reload } });
    expect(screen.getByTestId('service-count')).toHaveTextContent('Searching…');
  });

  it('says when nothing matches', () => {
    renderCatalogue({
      services: {
        status: 'success',
        data: { items: [], total: 0, categories: [] },
        reload,
      },
    });
    expect(screen.getByText(/No services match/)).toBeInTheDocument();
    expect(screen.getByTestId('service-count')).toHaveTextContent('0 services');
  });

  it('offers a retry when the services cannot be loaded', async () => {
    renderCatalogue({
      services: { status: 'error', error: new Error('503 Busy'), reload },
    });
    expect(screen.getByRole('alert')).toHaveTextContent('503 Busy');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
