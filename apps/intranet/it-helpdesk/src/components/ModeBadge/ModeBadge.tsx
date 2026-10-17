import styles from './ModeBadge.module.scss';

/** Shows whether the remote runs inside a shell or standalone. */
export function ModeBadge({ embedded }: { embedded: boolean }) {
  return (
    <span className={styles.badge} data-testid="mode-badge">
      {embedded ? 'Embedded in the shell' : 'Standalone mode'}
    </span>
  );
}
