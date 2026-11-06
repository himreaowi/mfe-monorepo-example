import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router';
import { useRemotePath } from '@org/mf-runtime/remote';
import { Alert, RemoteFallback, Spinner } from '@org/ui';
import type { ApiResult } from '@org/use-api';
import { routePaths } from '@/core/constants/routePaths';
import type { LeaveBalances, LeaveRequest } from '../../types/leave';
import { formatDays, formatRange } from '../../utils/dates';
import { LeaveBalanceCards } from '../LeaveBalanceCards/LeaveBalanceCards';
import { LeaveRequestList } from '../LeaveRequestList/LeaveRequestList';
import styles from './LeaveOverview.module.scss';

/** Router state the form leaves behind after a successful submit. */
export type LeaveOverviewState = { created?: LeaveRequest };

function createdFrom(state: unknown): LeaveRequest | undefined {
  const created = (state as LeaveOverviewState | null)?.created;
  return created && typeof created.id === 'string' ? created : undefined;
}

/**
 * Balance per leave type, the user's requests and the way to a new request. Displays only: the
 * page loads both (`useLeaveBalance()`, `useLeaveRequests()`) and passes the results down
 * (docs/coding-conventions.md "Data fetching").
 */
export function LeaveOverview({
  balance,
  requests,
}: {
  balance: ApiResult<LeaveBalances>;
  requests: ApiResult<LeaveRequest[]>;
}) {
  const toPath = useRemotePath();
  const created = createdFrom(useLocation().state);
  const successRef = useRef<HTMLDivElement>(null);
  const createdId = created?.id;

  // Coming back from the form: move focus to the confirmation so it is read out.
  useEffect(() => {
    if (createdId) successRef.current?.focus();
  }, [createdId]);

  return (
    <section className={styles.page} data-testid="leave-overview">
      <div className={styles.header}>
        <h1 className={styles.title}>Leave</h1>
        <Link className={styles.primaryLink} to={toPath(routePaths.newRequest)}>
          Request leave
        </Link>
      </div>
      {created ? (
        <Alert
          ref={successRef}
          variant="success"
          className={styles.success}
          tabIndex={-1}
          data-testid="leave-created"
        >
          Request {created.id} sent: {formatDays(created.days)},{' '}
          {formatRange(created.startDate, created.endDate)}. Your manager will
          review it.
        </Alert>
      ) : null}

      <section aria-labelledby="leave-balance-title">
        <h2 id="leave-balance-title" className={styles.sectionTitle}>
          Your balance
          {balance.status === 'success' ? ` for ${balance.data.year}` : ''}
        </h2>
        {balance.status === 'loading' ? (
          <Spinner label="Loading your balance…" labelVisible />
        ) : null}
        {balance.status === 'error' ? (
          <RemoteFallback
            title="Could not load your leave balance"
            reason={balance.error.message}
            onRetry={balance.reload}
          />
        ) : null}
        {balance.status === 'success' ? (
          <LeaveBalanceCards balances={balance.data.balances} />
        ) : null}
      </section>

      <section aria-labelledby="leave-requests-title">
        <h2 id="leave-requests-title" className={styles.sectionTitle}>
          Your requests
        </h2>
        {requests.status === 'loading' ? (
          <Spinner label="Loading your requests…" labelVisible />
        ) : null}
        {requests.status === 'error' ? (
          <RemoteFallback
            title="Could not load your leave requests"
            reason={requests.error.message}
            onRetry={requests.reload}
          />
        ) : null}
        {requests.status === 'success' ? (
          <LeaveRequestList
            requests={requests.data}
            balances={balance.status === 'success' ? balance.data.balances : []}
          />
        ) : null}
      </section>
    </section>
  );
}
