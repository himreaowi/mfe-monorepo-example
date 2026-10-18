import { render, screen, within } from '@testing-library/react';
import { balances, request } from '../../__fixtures__/leave';
import type { LeaveRequest } from '../../types/leave';
import { LeaveRequestList } from './LeaveRequestList';

const approved: LeaveRequest = {
  ...request,
  id: 'LR-0002',
  type: 'sick',
  startDate: '2026-05-04',
  endDate: '2026-05-04',
  days: 1,
  reason: '',
  status: 'approved',
};

describe('LeaveRequestList', () => {
  it('says so when there are no requests', () => {
    render(<LeaveRequestList requests={[]} balances={balances.balances} />);
    expect(
      screen.getByText('You have not requested any leave yet.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('lists each request with type, dates, status, days, reason and reference', () => {
    render(
      <LeaveRequestList requests={[request]} balances={balances.balances} />,
    );
    const list = screen.getByRole('list', { name: 'Your leave requests' });
    const item = within(list).getByTestId('leave-request');
    expect(
      within(item).getByRole('heading', {
        level: 3,
        name: 'Annual leave: 21 Dec 2026 to 24 Dec 2026',
      }),
    ).toBeInTheDocument();
    expect(item).toHaveTextContent('Waiting for approval');
    expect(item).toHaveTextContent('4 days · Year-end break');
    expect(item).toHaveTextContent('LR-0005, requested 15 Oct 2026');
  });

  it('shows the status label, no reason separator and the raw type when the balance is unknown', () => {
    render(
      <LeaveRequestList
        requests={[approved, { ...request, status: 'rejected' }]}
        balances={balances.balances}
      />,
    );
    const [sick, rejected] = screen.getAllByTestId('leave-request');
    expect(
      within(sick).getByRole('heading', { name: 'sick: 4 May 2026' }),
    ).toBeInTheDocument();
    expect(sick).toHaveTextContent('Approved');
    expect(sick).toHaveTextContent('1 day');
    expect(sick).not.toHaveTextContent('·');
    expect(rejected).toHaveTextContent('Not approved');
  });
});
