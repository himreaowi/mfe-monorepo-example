import { useState, type FormEvent } from 'react';
import { Button } from '@org/ui';
import { useSavePreferences } from '../hooks/useProfile';
import type { Preferences } from '../types/profile';
import styles from './Profile.module.scss';

/** Notification choices; saved with a PUT that carries the CSRF header. */
export function PreferencesForm({ initial }: { initial: Preferences }) {
  const [values, setValues] = useState(initial);
  const save = useSavePreferences();
  const saving = save.state.status === 'submitting';

  const toggle = (key: keyof Preferences) => (checked: boolean) => {
    save.reset();
    setValues((current) => ({ ...current, [key]: checked }));
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const outcome = await save.submit(values);
    if (outcome.ok) setValues(outcome.data.preferences);
  };

  return (
    <form
      className={styles.panel}
      onSubmit={onSubmit}
      aria-labelledby="preferences-title"
      data-testid="preferences-form"
    >
      <h2 id="preferences-title">Notifications</h2>
      <fieldset className={styles.fieldset}>
        <legend>How should we keep you informed?</legend>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={values.emailUpdates}
            onChange={(event) => toggle('emailUpdates')(event.target.checked)}
          />
          <span>Email me about service updates</span>
          <span className={styles.hint}>Maintenance, new services, fees.</span>
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={values.smsReminders}
            onChange={(event) => toggle('smsReminders')(event.target.checked)}
          />
          <span>Send me SMS reminders</span>
          <span className={styles.hint}>Renewals and appointments.</span>
        </label>
      </fieldset>
      <div className={styles.actions}>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save choices'}
        </Button>
        <p
          className={styles.saved}
          role="status"
          data-testid="preferences-status"
        >
          {save.state.status === 'success' ? 'Your choices are saved.' : ''}
        </p>
      </div>
      {save.state.status === 'error' ? (
        <p className={styles.error} role="alert">
          Your choices could not be saved ({save.state.error.message}). Try
          again.
        </p>
      ) : null}
    </form>
  );
}
