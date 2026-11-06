import { Card } from '@org/ui';
import type { LeaveBalance } from '../../types/leave';
import { formatDays } from '../../utils/dates';
import styles from './LeaveBalanceCards.module.scss';

/** One card per leave type: days left, entitlement, taken and pending. */
export function LeaveBalanceCards({ balances }: { balances: LeaveBalance[] }) {
  return (
    <ul className={styles.cards} aria-label="Leave balance">
      {balances.map((balance) => (
        <Card
          as="li"
          key={balance.type}
          title={balance.label}
          headingLevel={3}
          className={styles.card}
          data-testid="leave-balance"
        >
          {balance.remaining === null ? (
            <p className={styles.big}>No limit</p>
          ) : (
            <p>
              <span className={styles.big}>{balance.remaining}</span>{' '}
              {balance.remaining === 1 ? 'day left' : 'days left'}
            </p>
          )}
          <p className={styles.muted}>
            {balance.entitled === null
              ? `${formatDays(balance.taken)} taken`
              : `${balance.entitled} a year, ${balance.taken} taken`}
            {balance.pending > 0 ? `, ${balance.pending} pending` : ''}
          </p>
        </Card>
      ))}
    </ul>
  );
}
