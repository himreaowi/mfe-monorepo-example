import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { StaffFiltersProvider } from '../../state/StaffFiltersContext';
import { StaffFilters } from './StaffFilters';

function Location() {
  return <span data-testid="location">{useLocation().search}</span>;
}

function renderFilters(url = '/staff') {
  render(
    <MemoryRouter initialEntries={[url]}>
      <StaffFiltersProvider>
        <StaffFilters departments={['Finance', 'Technology']} />
        <Location />
      </StaffFiltersProvider>
    </MemoryRouter>,
  );
}

describe('StaffFilters', () => {
  it('shows the filters of the URL', () => {
    renderFilters('/staff?q=ann&department=Finance');
    expect(screen.getByRole('search', { name: 'Staff' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search staff' })).toHaveValue(
      'ann',
    );
    expect(screen.getByRole('combobox', { name: 'Department' })).toHaveValue(
      'Finance',
    );
  });

  it('lists the departments after "All departments"', () => {
    renderFilters();
    expect(
      screen.getAllByRole('option').map((option) => option.textContent),
    ).toEqual(['All departments', 'Finance', 'Technology']);
  });

  it('changes the shared filters (and so the URL)', async () => {
    renderFilters();
    await userEvent.type(
      screen.getByRole('searchbox', { name: 'Search staff' }),
      'secu',
    );
    expect(screen.getByTestId('location')).toHaveTextContent('?q=secu');
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Department' }),
      'Technology',
    );
    expect(screen.getByTestId('location')).toHaveTextContent(
      '?q=secu&department=Technology',
    );
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Department' }),
      '',
    );
    expect(screen.getByTestId('location')).toHaveTextContent('?q=secu');
  });
});
