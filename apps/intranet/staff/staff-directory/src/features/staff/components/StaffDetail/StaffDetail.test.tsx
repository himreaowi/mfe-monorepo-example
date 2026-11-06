import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import type { StaffMember } from '@org/intranet-directory';
import type { StaffMemberQuery } from '../../hooks/useStaffMember';
import { StaffDetail } from './StaffDetail';

const priya: StaffMember = {
  id: 's-2',
  name: 'Priya Nair',
  jobTitle: 'Security Engineer',
  department: 'Technology',
  location: 'Level 3',
  email: 'priya.nair@example.org',
  phone: '+65 6555 1106',
  skills: ['Security', 'Identity'],
  startDate: '2020-01-01',
  manager: { id: 's-1', name: 'Oliver Chan' },
  directReports: [],
};
const refetch = jest.fn();

// A display component: the page loads the person and passes the result in (no API here).
/** The part of a Query result the component reads. */
function renderDetail(member: object) {
  return render(
    <MemoryRouter>
      <HostPropsProvider value={{ embedded: true, basePath: '/staff' }}>
        <StaffDetail member={member as StaffMemberQuery} />
      </HostPropsProvider>
    </MemoryRouter>,
  );
}

describe('StaffDetail', () => {
  it('shows contact details, manager and skills', () => {
    renderDetail({ status: 'success', data: priya, refetch });
    expect(
      screen.getByRole('heading', { level: 1, name: 'Priya Nair' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Oliver Chan' })).toHaveAttribute(
      'href',
      '/staff/s-1',
    );
    expect(
      screen.getByRole('link', { name: 'priya.nair@example.org' }),
    ).toHaveAttribute('href', 'mailto:priya.nair@example.org');
    expect(screen.getByRole('list', { name: 'Skills' })).toHaveTextContent(
      'SecurityIdentity',
    );
    expect(
      screen.getByRole('link', { name: 'Back to the staff directory' }),
    ).toHaveAttribute('href', '/staff');
  });

  it('shows the NRIC masked and never in full', () => {
    const { container } = renderDetail({
      status: 'success',
      data: { ...priya, nric: 'S1234567D' },
      refetch,
    });
    expect(screen.getByText('NRIC')).toBeInTheDocument();
    expect(screen.getByTestId('staff-nric')).toHaveTextContent('S****567D');
    expect(container.textContent).not.toContain('S1234567D');
    expect(container.textContent).not.toContain('1234');
  });

  it('shows an NRIC the backend already masked unchanged', () => {
    renderDetail({
      status: 'success',
      data: { ...priya, nric: 'S****567D' },
      refetch,
    });
    expect(screen.getByTestId('staff-nric')).toHaveTextContent('S****567D');
  });

  it('shows no NRIC row when the API sends none', () => {
    renderDetail({ status: 'success', data: priya, refetch });
    expect(screen.queryByText('NRIC')).not.toBeInTheDocument();
  });

  it('shows loading', () => {
    renderDetail({ status: 'pending', refetch });
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
  });

  it('says so when the person does not exist', () => {
    renderDetail({ status: 'success', data: null, refetch });
    expect(
      screen.getByRole('heading', { name: 'Staff member not found' }),
    ).toBeInTheDocument();
  });

  it('offers a retry when the person cannot be loaded', async () => {
    renderDetail({
      status: 'error',
      error: new Error('502 Bad Gateway'),
      refetch,
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not load this staff member',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
