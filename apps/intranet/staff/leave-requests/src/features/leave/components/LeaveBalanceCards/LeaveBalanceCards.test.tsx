import { render, screen, within } from '@testing-library/react';
import { balances } from '../../__fixtures__/leave';
import type { LeaveBalance } from '../../types/leave';
import { LeaveBalanceCards } from './LeaveBalanceCards';

describe('LeaveBalanceCards', () => {
  it('renders one card per leave type in a labelled list', () => {
    render(<LeaveBalanceCards balances={balances.balances} />);
    const list = screen.getByRole('list', { name: 'Leave balance' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(
      within(list).getByRole('heading', { level: 3, name: 'Annual leave' }),
    ).toBeInTheDocument();
    expect(
      within(list).getByRole('heading', { level: 3, name: 'No-pay leave' }),
    ).toBeInTheDocument();
  });

  it('shows days left, the yearly entitlement, taken and pending days', () => {
    render(<LeaveBalanceCards balances={balances.balances} />);
    const [annual] = screen.getAllByTestId('leave-balance');
    expect(annual).toHaveTextContent('7 days left');
    expect(annual).toHaveTextContent('18 a year, 7 taken, 4 pending');
  });

  it('shows "No limit" and only the days taken for leave without entitlement', () => {
    render(<LeaveBalanceCards balances={balances.balances} />);
    const unpaid = screen.getAllByTestId('leave-balance')[1];
    expect(unpaid).toHaveTextContent('No limit');
    expect(unpaid).toHaveTextContent('0 days taken');
    expect(unpaid).not.toHaveTextContent('pending');
  });

  it('uses the singular for one day left', () => {
    const sick: LeaveBalance = {
      type: 'sick',
      label: 'Sick leave',
      entitled: 14,
      taken: 13,
      pending: 0,
      remaining: 1,
    };
    render(<LeaveBalanceCards balances={[sick]} />);
    expect(screen.getByTestId('leave-balance')).toHaveTextContent(
      'Sick leave1 day left14 a year, 13 taken',
    );
  });

  it('renders an empty list when there are no balances', () => {
    render(<LeaveBalanceCards balances={[]} />);
    expect(
      within(
        screen.getByRole('list', { name: 'Leave balance' }),
      ).queryAllByRole('listitem'),
    ).toHaveLength(0);
  });
});
