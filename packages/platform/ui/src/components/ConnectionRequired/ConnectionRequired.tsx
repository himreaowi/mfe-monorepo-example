import styles from './ConnectionRequired.module.scss';

export type ConnectionRequiredProps = {
  visible?: boolean;
};

export function ConnectionRequired({
  visible = true,
}: ConnectionRequiredProps) {
  if (!visible) return null;
  return (
    <div
      className={styles.banner}
      role="status"
      aria-live="polite"
      data-testid="connection-required"
    >
      Internet connection required for some features.
    </div>
  );
}
