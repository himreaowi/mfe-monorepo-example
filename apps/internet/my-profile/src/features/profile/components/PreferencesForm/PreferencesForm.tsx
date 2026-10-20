import { useId, useRef, useState, type FormEvent } from 'react';
import { HttpClientError } from '@org/http-client';
import { Alert, Button, Checkbox, VisuallyHidden } from '@org/ui';
import type { SubmitResult } from '@org/use-api';
import type { Preferences, Profile } from '../../types/profile';
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
 * docs/coding-conventions.md), other failures as a form-level error. The button shows `loading`
 * only while saving. It sends nothing itself: `save` comes from the page
 * (`useSavePreferences()`); the form keeps only its own UI state (choices, field error).
 */
export function PreferencesForm({
  initial,
  save,
}: {
  initial: Preferences;
  save: SubmitResult<Preferences, Profile>;
}) {
  const [values, setValues] = useState(initial);
  const [fieldError, setFieldError] = useState<string>();
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
        <Alert
          ref={summaryRef}
          variant="error"
          title="There is a problem"
          headingLevel={3}
          className={styles.summary}
          tabIndex={-1}
          data-testid="error-summary"
        >
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
        </Alert>
      ) : null}
      <fieldset
        className={styles.fieldset}
        aria-describedby={fieldError ? errorId : undefined}
      >
        <legend>How should we keep you informed?</legend>
        {fieldError ? (
          <p className={styles.error} id={errorId}>
            <VisuallyHidden>Error: </VisuallyHidden>
            {fieldError}
          </p>
        ) : null}
        <Checkbox
          id={firstChoiceId}
          label="Email me about service updates"
          hint="Maintenance, new services, fees."
          checked={values.emailUpdates}
          aria-invalid={fieldError ? true : undefined}
          onChange={(event) => toggle('emailUpdates')(event.target.checked)}
        />
        <Checkbox
          label="Send me SMS reminders"
          hint="Renewals and appointments."
          checked={values.smsReminders}
          aria-invalid={fieldError ? true : undefined}
          onChange={(event) => toggle('smsReminders')(event.target.checked)}
        />
      </fieldset>
      <div className={styles.actions}>
        <Button type="submit" loading={saving}>
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
        <Alert variant="error">
          Your choices could not be saved ({formError.message}). Try again.
        </Alert>
      ) : null}
    </form>
  );
}
