import {
  LeaveOverview,
  useLeaveBalance,
  useLeaveRequests,
} from '@/features/leave';

/**
 * Page-level data fetching: the page loads the balance and the requests, `LeaveOverview`
 * displays them. Every API call of the page is here (docs/coding-conventions.md "Data fetching").
 */
export function OverviewPage() {
  const balance = useLeaveBalance();
  const requests = useLeaveRequests();
  return (
    <div data-testid="overview-page">
      <LeaveOverview balance={balance} requests={requests} />
    </div>
  );
}
