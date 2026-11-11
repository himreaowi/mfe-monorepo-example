import { LeaveRequestForm } from '@/components/LeaveRequestForm/LeaveRequestForm';
import { useLeaveBalance } from '@/hooks/useLeaveBalance';
import { useSubmitLeaveRequest } from '@/hooks/useSubmitLeaveRequest';
import styles from './NewLeavePage.module.scss';

/**
 * Page-level data fetching: the page loads the balance (leave types and what is left) and owns
 * the "send request" request; `LeaveRequestForm` validates, displays and calls `save.mutate`.
 */
export function NewLeavePage() {
  const balance = useLeaveBalance();
  const save = useSubmitLeaveRequest();
  return (
    <section className={styles.page} data-testid="new-leave-page">
      <h1 className={styles.title}>Request leave</h1>
      <p className={styles.lead}>
        Your manager gets the request and replies within 2 working days.
      </p>
      <LeaveRequestForm balance={balance} save={save} />
    </section>
  );
}
