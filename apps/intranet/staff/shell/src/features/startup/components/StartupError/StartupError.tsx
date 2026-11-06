import { Button, ConnectionRequired } from '@org/ui';
import { useOnlineStatus } from '@org/pwa';
import styles from './StartupError.module.scss';

export type StartupErrorProps = {
  error: unknown;
  /** Default: reload the page. */
  onRetry?: () => void;
};

/**
 * Shown when the shell cannot start, i.e. /mfe-manifest.json could not be loaded or is
 * invalid. Offline → connection-required message; otherwise the (validated) error.
 */
export function StartupError({
  error,
  onRetry = () => window.location.reload(),
}: StartupErrorProps) {
  const online = useOnlineStatus();
  const message = error instanceof Error ? error.message : String(error);
  return (
    <main className={styles.page} data-testid="startup-error">
      <ConnectionRequired visible={!online} />
      <div className={styles.panel} role="alert">
        <h1 className={styles.title}>
          {online ? 'The app could not start' : 'You are offline'}
        </h1>
        <p className={styles.copy}>
          {online
            ? 'The app configuration (mfe-manifest.json) could not be loaded.'
            : 'Connect to the internet and try again.'}
        </p>
        {online ? <pre className={styles.details}>{message}</pre> : null}
        <Button onClick={onRetry}>Try again</Button>
      </div>
    </main>
  );
}
