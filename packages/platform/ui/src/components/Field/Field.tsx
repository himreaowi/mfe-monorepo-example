import { useId, type ReactNode } from 'react';
import { cx } from '../../utils/cx/cx';
import { VisuallyHidden } from '../VisuallyHidden/VisuallyHidden';
import styles from './Field.module.scss';

/** Props the Field hands to its control (spread them onto the `<input>`/`<select>`/…). */
export type FieldControlProps = {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
  required?: boolean;
};

/** Label, hint and error props shared by every field component. */
export type FieldLabelProps = {
  /** Visible label (required: placeholders are not labels). */
  label: ReactNode;
  /** Help text under the label, linked with `aria-describedby`. */
  hint?: ReactNode;
  /** Error message: shown under the hint, linked with `aria-describedby`, sets `aria-invalid`. */
  error?: ReactNode;
  /** Sets `required` on the control and shows `(required)` after the label. */
  required?: boolean;
};

export type FieldProps = FieldLabelProps & {
  /** The control's id. Default: generated (`useId`). */
  id?: string;
  /** More ids for `aria-describedby` (e.g. from the caller's own `aria-describedby`). */
  describedBy?: string;
  /** Class of the wrapper (width, margins). */
  className?: string;
  /** Renders the control with the ids and ARIA attributes it needs. */
  children: (control: FieldControlProps) => ReactNode;
};

/**
 * Label + hint + error around one form control, wired for screen readers: `<label for>`,
 * `aria-describedby` = hint + error, `aria-invalid` when there is an error. TextField,
 * TextArea, Select and DateField are built on it; use it directly for a custom control.
 */
export function Field({
  label,
  hint,
  error,
  required,
  id,
  describedBy,
  className,
  children,
}: FieldProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;
  const hasError =
    error !== undefined && error !== null && error !== false && error !== '';
  const describedByIds = [
    hint ? hintId : '',
    hasError ? errorId : '',
    describedBy ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cx(styles.field, className)}>
      <label htmlFor={controlId} className={styles.label}>
        {label}
        {required ? <span className={styles.required}> (required)</span> : null}
      </label>
      {hint ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
      {hasError ? (
        <p id={errorId} className={styles.error}>
          <VisuallyHidden>Error: </VisuallyHidden>
          {error}
        </p>
      ) : null}
      {children({
        id: controlId,
        'aria-describedby': describedByIds || undefined,
        'aria-invalid': hasError ? true : undefined,
        required: required || undefined,
      })}
    </div>
  );
}
