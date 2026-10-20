import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { HostPropsProvider } from '@org/mf-runtime/remote';
import { getLeaveBalance, getLeaveRequests } from '../../api/leaveApi';
import { LeaveOverview } from './LeaveOverview';
import { balances, request } from '../../__fixtures__/leave';

jest.mock('../../api/leaveApi');

function renderOverview(state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/leave', state }]}>
      <HostPropsProvider
        value={{
          embedded: true,
          basePath: '/leave',
          settings: { apiBaseUrl: 'https://api.test' },
        }}
      >
        <LeaveOverview />
      </HostPropsProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  jest.mocked(getLeaveBalance).mockResolvedValue(balances);
  jest.mocked(getLeaveRequests).mockResolvedValue([request]);
});

describe('LeaveOverview', () => {
  it('shows the balance per type and the requests', async () => {
    renderOverview();
    const cards = await screen.findAllByTestId('leave-balance');
    expect(cards[0]).toHaveTextContent(
      'Annual leave7 days left18 a year, 7 taken, 4 pending',
    );
    expect(cards[1]).toHaveTextContent('No limit');
    const item = await screen.findByTestId('leave-request');
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

  it('confirms a request that was just sent and focuses the message', async () => {
    renderOverview({ created: request });
    const message = screen.getByTestId('leave-created');
    expect(message).toHaveTextContent(
      'Request LR-0005 sent: 4 days, 21 Dec 2026 to 24 Dec 2026.',
    );
    expect(message).toHaveFocus();
    await screen.findAllByTestId('leave-balance');
  });

  it('offers a retry when the balance fails', async () => {
    jest
      .mocked(getLeaveBalance)
      .mockRejectedValue(new Error('502 Bad Gateway'));
    renderOverview();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load your leave balance',
    );
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
  });
});
