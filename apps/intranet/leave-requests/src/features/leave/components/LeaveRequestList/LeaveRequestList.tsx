import { Badge, Card, type BadgeVariant } from '@org/ui';
import type {
  LeaveBalance,
  LeaveRequest,
  LeaveStatus,
} from '../../types/leave';
import { formatDate, formatDays, formatRange } from '../../utils/dates';
import styles from './LeaveRequestList.module.scss';

const STATUS: Record<LeaveStatus, { label: string; variant: BadgeVariant }> = {
  pending: { label: 'Waiting for approval', variant: 'warning' },
  approved: { label: 'Approved', variant: 'success' },
  rejected: { label: 'Not approved', variant: 'danger' },
};

export function LeaveRequestList({
  requests,
  balances,
}: {
  requests: LeaveRequest[];
  balances: LeaveBalance[];
}) {
  if (requests.length === 0) {
    return (
      <p className={styles.muted}>You have not requested any leave yet.</p>
    );
  }
  const label = (type: string) =>
    balances.find((b) => b.type === type)?.label ?? type;
  return (
    <ul className={styles.requests} aria-label="Your leave requests">
      {requests.map((request) => (
        <Card
          as="li"
          key={request.id}
          className={styles.request}
          data-testid="leave-request"
        >
          <h3 className={styles.requestTitle}>
            {label(request.type)}:{' '}
            {formatRange(request.startDate, request.endDate)}
          </h3>
          <Badge
            variant={STATUS[request.status].variant}
            className={styles.status}
          >
            {STATUS[request.status].label}
          </Badge>
          <p className={styles.full}>
            {formatDays(request.days)}
            {request.reason ? ` · ${request.reason}` : ''}
          </p>
          <p className={`${styles.full} ${styles.muted}`}>
            {request.id}, requested {formatDate(request.createdAt)}
          </p>
        </Card>
      ))}
    </ul>
  );
}
