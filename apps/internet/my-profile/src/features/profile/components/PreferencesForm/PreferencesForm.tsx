import { useId, useRef, useState, type FormEvent } from 'react';
import { HttpClientError } from '@org/http-client';
import { Button } from '@org/ui';
import { useSavePreferences } from '../../hooks/useProfile';
import type { Preferences } from '../../types/profile';
import styles from './PreferencesForm.module.scss';

/** The `preferences` field error of a 422 (`{ errors: { preferences } }`), if there is one. */
function preferencesError(error: Error): string | undefined {
  if (!(error instanceof HttpClientError) || error.status !== 422) {
    return undefined;
  }
  const errors = (error.body as { errors?: Record<string, unknown> } | null)
    ?.errors;
  const message = errors?.preferences;
  return typeof message === 'string' ? message : undefined;
}

/**
 * Notification choices; saved with a PUT that carries the CSRF header. Two checkboxes cannot be
 * invalid on the client, so only the server validates: a 422 is shown like any form error
 * (focused error summary linking to the choices + the error next to them,
 * docs/coding-conventions.md), other failures as a form-level error. The button is disabled
 * only while saving.
 */
export function PreferencesForm({ initial }: { initial: Preferences }) {
  const [values, setValues] = useState(initial);
  const [fieldError, setFieldError] = useState<string>();
  const save = useSavePreferences();
  const saving = save.state.status === 'submitting';
  const summaryRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const firstChoiceId = `${id}-email`;
  const errorId = `${id}-error`;

  const toggle = (key: keyof Preferences) => (checked: boolean) => {
    save.reset();
    setValues((current) => ({ ...current, [key]: checked }));
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldError(undefined);
    const outcome = await save.submit(values);
    if (outcome.ok) {
      setValues(outcome.data.preferences);
      return;
    }
    const message = outcome.aborted
      ? undefined
      : preferencesError(outcome.error);
    if (message) {
      setFieldError(message);
      // after React rendered the summary
      requestAnimationFrame(() => summaryRef.current?.focus());
    }
  };

  const formError =
    save.state.status === 'error' && !fieldError ? save.state.error : null;

  return (
    <form
      className={styles.panel}
      noValidate
      onSubmit={onSubmit}
      aria-labelledby="preferences-title"
      data-testid="preferences-form"
    >
      <h2 id="preferences-title">Notifications</h2>
      {fieldError ? (
        <div
          ref={summaryRef}
          className={styles.summary}
          role="alert"
          tabIndex={-1}
          aria-labelledby={`${id}-summary`}
          data-testid="error-summary"
        >
          <h3 id={`${id}-summary`}>There is a problem</h3>
          <ul>
            <li>
              <a
                href={`#${firstChoiceId}`}
                onClick={(event) => {
                  event.preventDefault();
                  document.getElementById(firstChoiceId)?.focus();
                }}
              >
                {fieldError}
              </a>
            </li>
          </ul>
        </div>
      ) : null}
      <fieldset
        className={styles.fieldset}
        aria-describedby={fieldError ? errorId : undefined}
      >
        <legend>How should we keep you informed?</legend>
        {fieldError ? (
          <p className={styles.error} id={errorId}>
            <span className={styles.visuallyHidden}>Error: </span>
            {fieldError}
          </p>
        ) : null}
        <label className={styles.check}>
          <input
            id={firstChoiceId}
            type="checkbox"
            checked={values.emailUpdates}
            aria-invalid={fieldError ? true : undefined}
            onChange={(event) => toggle('emailUpdates')(event.target.checked)}
          />
          <span>Email me about service updates</span>
          <span className={styles.hint}>Maintenance, new services, fees.</span>
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={values.smsReminders}
            aria-invalid={fieldError ? true : undefined}
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
      {formError ? (
        <p className={styles.error} role="alert">
          Your choices could not be saved ({formError.message}). Try again.
        </p>
      ) : null}
    </form>
  );
}
