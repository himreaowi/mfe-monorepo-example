import { Link } from 'react-router';
import { useHostProps, useRemotePath } from '@org/mf-runtime/remote';
import styles from './Demo.module.scss';

/** Second sample page: shows where the remote is mounted and links back. */
export function DemoDetails() {
  const { basePath } = useHostProps();
  const toPath = useRemotePath();
  return (
    <section className={styles.panel} data-testid="demo-details">
      <h1 className={styles.title}>Details</h1>
      <p className={styles.copy}>
        Mounted at <code data-testid="demo-base-path">{basePath}</code>.
      </p>
      <Link to={toPath('')}>Back to overview</Link>
    </section>
  );
}
