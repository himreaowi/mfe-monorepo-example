import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import type { ApiResult } from '@org/use-api';
import type { StaffMember } from '../../types/staff';
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
const reload = jest.fn();

// A display component: the page loads the person and passes the result in (no API here).
function renderDetail(member: ApiResult<StaffMember | null>) {
  return render(
    <MemoryRouter>
      <HostPropsProvider value={{ embedded: true, basePath: '/staff' }}>
        <StaffDetail member={member} />
      </HostPropsProvider>
    </MemoryRouter>,
  );
}

describe('StaffDetail', () => {
  it('shows contact details, manager and skills', () => {
    renderDetail({ status: 'success', data: priya, reload });
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

  it('shows loading', () => {
    renderDetail({ status: 'loading', reload });
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
  });

  it('says so when the person does not exist', () => {
    renderDetail({ status: 'success', data: null, reload });
    expect(
      screen.getByRole('heading', { name: 'Staff member not found' }),
    ).toBeInTheDocument();
  });

  it('offers a retry when the person cannot be loaded', async () => {
    renderDetail({
      status: 'error',
      error: new Error('502 Bad Gateway'),
      reload,
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not load this staff member',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
