import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import { getStaffMember } from '../api';
import { StaffDetail } from './StaffDetail';

jest.mock('../api');
const getMock = jest.mocked(getStaffMember);

function renderDetail(id: string) {
  return render(
    <MemoryRouter>
      <HostPropsProvider value={{ embedded: true, basePath: '/staff' }}>
        <StaffDetail id={id} />
      </HostPropsProvider>
    </MemoryRouter>,
  );
}

describe('StaffDetail', () => {
  it('shows contact details, manager and skills', async () => {
    getMock.mockResolvedValue({
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
    });
    renderDetail('s-2');
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Priya Nair' }),
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

  it('says so when the person does not exist', async () => {
    getMock.mockResolvedValue(null);
    renderDetail('nobody');
    expect(
      await screen.findByRole('heading', { name: 'Staff member not found' }),
    ).toBeInTheDocument();
  });
});
