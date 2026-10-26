import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { StaffSummary } from '../../types/staff';
import { StaffCard } from './StaffCard';

const ann: StaffSummary = {
  id: 's-1',
  name: 'Ann Lee',
  jobTitle: 'Engineer',
  department: 'Technology',
  location: 'Level 3',
  email: 'ann.lee@example.org',
  phone: '+65 6555 0001',
};

function renderCard(to: string) {
  return render(
    <MemoryRouter>
      <ul aria-label="Staff">
        <StaffCard member={ann} to={to} />
      </ul>
    </MemoryRouter>,
  );
}

describe('StaffCard', () => {
  it('shows the name as a heading link to the given path', () => {
    renderCard('/staff-directory/s-1');
    const card = screen.getByRole('listitem');
    const link = within(card).getByRole('link', { name: 'Ann Lee' });
    expect(link).toHaveAttribute('href', '/staff-directory/s-1');
    expect(
      within(card).getByRole('heading', { level: 2, name: 'Ann Lee' }),
    ).toBeInTheDocument();
  });

  it('shows the job title, department, location and a mail link', () => {
    renderCard('/s-1');
    const card = screen.getByRole('listitem');
    expect(card).toHaveTextContent('Engineer');
    expect(card).toHaveTextContent('Technology, Level 3');
    expect(
      within(card).getByRole('link', { name: 'ann.lee@example.org' }),
    ).toHaveAttribute('href', 'mailto:ann.lee@example.org');
    expect(within(card).getByRole('link', { name: 'Ann Lee' })).toHaveAttribute(
      'href',
      '/s-1',
    );
  });
});
