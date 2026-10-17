import { LeaveRequestForm } from '@/features/leave';
import styles from './NewLeavePage.module.scss';

export function NewLeavePage() {
  return (
    <section className={styles.page} data-testid="new-leave-page">
      <h1 className={styles.title}>Request leave</h1>
      <p className={styles.lead}>
        Your manager gets the request and replies within 2 working days.
      </p>
      <LeaveRequestForm />
    </section>
  );
}
