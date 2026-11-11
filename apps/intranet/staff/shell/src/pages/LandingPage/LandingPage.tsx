import { useId } from 'react';
import { useAuth } from '@org/auth';
import { Button } from '@org/ui';
import {
  LANDING_SIGN_IN_LABEL,
  LANDING_TEXT,
  LANDING_TITLE,
  LANDING_UNAVAILABLE_TEXT,
} from '@/core/constants/signIn';
import styles from './LandingPage.module.scss';

/**
 * What a signed-out user sees when the whole portal needs sign-in (SIGN_IN_REQUIRED,
 * src/core/constants/signIn.ts). The button calls the same `signIn` as the header's user menu;
 * without `returnTo` the user comes back to the current address, i.e. the one first requested
 * (the signed-out view never changes the URL).
 */
export function LandingPage() {
  const auth = useAuth();
  const headingId = useId();
  const disabled = auth.status === 'disabled';
  return (
    <section
      className={styles.landing}
      aria-labelledby={headingId}
      data-testid="landing-page"
    >
      <h1 id={headingId} className={styles.title}>
        {LANDING_TITLE}
      </h1>
      <p className={styles.text}>
        {disabled ? LANDING_UNAVAILABLE_TEXT : LANDING_TEXT}
      </p>
      {auth.error && !disabled ? (
        <p className={styles.error} role="alert" data-testid="auth-error">
          {auth.error.message}
        </p>
      ) : null}
      {disabled ? null : (
        <Button
          data-testid="landing-sign-in"
          onClick={() => void auth.signIn()}
        >
          {LANDING_SIGN_IN_LABEL}
        </Button>
      )}
    </section>
  );
}
