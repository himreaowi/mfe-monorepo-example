import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router';
import { useRemotePath } from '@org/mf-runtime/remote';
import { RemoteFallback } from '@org/ui';
import { routePaths } from '@/core/constants/routePaths';
import { useLeaveBalance } from '../../hooks/useLeaveBalance';
import { useLeaveRequests } from '../../hooks/useLeaveRequests';
import type { LeaveRequest } from '../../types/leave';
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

/** Balance per leave type, the user's requests and the way to a new request. */
export function LeaveOverview() {
  const toPath = useRemotePath();
  const balance = useLeaveBalance();
  const requests = useLeaveRequests();
  const created = createdFrom(useLocation().state);
  const successRef = useRef<HTMLParagraphElement>(null);
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
        <p
          ref={successRef}
          className={styles.success}
          role="status"
          tabIndex={-1}
          data-testid="leave-created"
        >
          Request {created.id} sent: {formatDays(created.days)},{' '}
          {formatRange(created.startDate, created.endDate)}. Your manager will
          review it.
        </p>
      ) : null}

      <section aria-labelledby="leave-balance-title">
        <h2 id="leave-balance-title" className={styles.sectionTitle}>
          Your balance
          {balance.status === 'success' ? ` for ${balance.data.year}` : ''}
        </h2>
        {balance.status === 'loading' ? (
          <p role="status">Loading your balance…</p>
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
          <p role="status">Loading your requests…</p>
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
