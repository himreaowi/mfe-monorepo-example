import type { ReactNode } from 'react';
import styles from './LeaveRequestForm.module.scss';

type FieldProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: (describedBy: string | undefined) => ReactNode;
};

/**
 * Label, optional hint and error message, wired to the control with aria-describedby. Private
 * part of LeaveRequestForm (uses its CSS module; not exported from index.ts).
 */
export function Field({ id, label, hint, error, children }: FieldProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint ? hintId : '', error ? errorId : ''].filter(Boolean).join(' ') ||
    undefined;
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      {hint ? (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className={styles.error} id={errorId}>
          <span className={styles.visuallyHidden}>Error: </span>
          {error}
        </p>
      ) : null}
      {children(describedBy)}
    </div>
  );
}
