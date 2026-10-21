import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import { ann } from '../../__fixtures__/staff';
import { StaffCard } from './StaffCard';

function renderCard(basePath: string) {
  return render(
    <MemoryRouter>
      <HostPropsProvider value={{ embedded: basePath !== '/', basePath }}>
        <ul aria-label="Staff">
          <StaffCard member={ann} />
        </ul>
      </HostPropsProvider>
    </MemoryRouter>,
  );
}

describe('StaffCard', () => {
  it('shows the name as a heading link to the detail page below the mount', () => {
    renderCard('/staff-directory');
    const card = screen.getByRole('listitem');
    const link = within(card).getByRole('link', { name: 'Ann Lee' });
    expect(link).toHaveAttribute('href', '/staff-directory/s-1');
    expect(
      within(card).getByRole('heading', { level: 2, name: 'Ann Lee' }),
    ).toBeInTheDocument();
  });

  it('shows the job title, department, location and a mail link', () => {
    renderCard('/');
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
