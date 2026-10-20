import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import userEvent from '@testing-library/user-event';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import type { ApiResult } from '@org/use-api';
import type { LeaveBalances, LeaveRequest } from '../../types/leave';
import { LeaveOverview } from './LeaveOverview';
import { balances, request } from '../../__fixtures__/leave';

const reload = jest.fn();
const loadedBalance: ApiResult<LeaveBalances> = {
  status: 'success',
  data: balances,
  reload,
};
const loadedRequests: ApiResult<LeaveRequest[]> = {
  status: 'success',
  data: [request],
  reload,
};

// A display component: the page loads balance and requests and passes them in (no API here).
function renderOverview(
  state?: unknown,
  {
    balance = loadedBalance,
    requests = loadedRequests,
  }: {
    balance?: ApiResult<LeaveBalances>;
    requests?: ApiResult<LeaveRequest[]>;
  } = {},
) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/leave', state }]}>
      <HostPropsProvider value={{ embedded: true, basePath: '/leave' }}>
        <LeaveOverview balance={balance} requests={requests} />
      </HostPropsProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => reload.mockReset());

describe('LeaveOverview', () => {
  it('shows the balance per type and the requests', () => {
    renderOverview();
    const cards = screen.getAllByTestId('leave-balance');
    expect(cards[0]).toHaveTextContent(
      'Annual leave7 days left18 a year, 7 taken, 4 pending',
    );
    expect(cards[1]).toHaveTextContent('No limit');
    const item = screen.getByTestId('leave-request');
    expect(
      within(item).getByRole('heading', {
        name: 'Annual leave: 21 Dec 2026 to 24 Dec 2026',
      }),
    ).toBeInTheDocument();
    expect(item).toHaveTextContent('Waiting for approval');
    expect(item).toHaveTextContent('4 days · Year-end break');
    expect(screen.getByRole('link', { name: 'Request leave' })).toHaveAttribute(
      'href',
      '/leave/new',
    );
  });

  it('confirms a request that was just sent and focuses the message', () => {
    renderOverview({ created: request });
    const message = screen.getByTestId('leave-created');
    expect(message).toHaveTextContent(
      'Request LR-0005 sent: 4 days, 21 Dec 2026 to 24 Dec 2026.',
    );
    expect(message).toHaveFocus();
  });

  it('shows loading for each part', () => {
    renderOverview(undefined, {
      balance: { status: 'loading', reload },
      requests: { status: 'loading', reload },
    });
    expect(screen.getByText('Loading your balance…')).toBeInTheDocument();
    expect(screen.getByText('Loading your requests…')).toBeInTheDocument();
  });

  it('offers a retry when the balance fails', async () => {
    renderOverview(undefined, {
      balance: { status: 'error', error: new Error('502 Bad Gateway'), reload },
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not load your leave balance',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
