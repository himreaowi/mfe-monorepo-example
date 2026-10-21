import { Link } from 'react-router';
import { useAuth } from '@org/auth';
import { APP_INTRO, APP_TITLE } from '@/core/constants/app';
import type { RemoteEntry } from '@/core/types/remotes';
import styles from './Welcome.module.scss';

/** Home page: what this portal offers, one card per remote (from remotes.json). */
export function Welcome({ remotes }: { remotes: RemoteEntry[] }) {
  const { status, user } = useAuth();
  const name = status === 'signedIn' ? (user?.name ?? user?.id) : undefined;
  return (
    <section className={styles.welcome} data-testid="shell-welcome">
      <div className={styles.hero}>
        <h1 className={styles.title}>{APP_TITLE}</h1>
        <p className={styles.copy}>{APP_INTRO}</p>
        {name ? (
          <p className={styles.greeting} data-testid="welcome-user">
            Welcome back, {name}.
          </p>
        ) : null}
      </div>
      {remotes.length === 0 ? (
        <p className={styles.copy} data-testid="no-remotes">
          No remotes yet. Add one with{' '}
          <code>pnpm gen:remote intranet &lt;name&gt;</code>.
        </p>
      ) : (
        <>
          <h2 className={styles.sectionTitle}>What do you want to do?</h2>
          <ul className={styles.cards}>
            {remotes.map((remote) => (
              <li key={remote.name} className={styles.card}>
                <h3 className={styles.cardTitle}>
                  <Link to={remote.path}>{remote.title}</Link>
                </h3>
                {remote.description ? (
                  <p className={styles.cardText}>{remote.description}</p>
                ) : null}
                {remote.access === 'private' ? (
                  <span className={styles.badge}>Sign-in required</span>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
