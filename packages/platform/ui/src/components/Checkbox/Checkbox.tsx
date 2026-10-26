import { useId, type ComponentPropsWithRef, type ReactNode } from 'react';
import { cx } from '../../utils/cx/cx';
import { VisuallyHidden } from '../VisuallyHidden/VisuallyHidden';
import styles from './Checkbox.module.scss';

export type CheckboxProps = Omit<ComponentPropsWithRef<'input'>, 'type'> & {
  /** Visible label, next to the box (clicking it toggles the box). */
  label: ReactNode;
  /** Help text under the label, linked with `aria-describedby`. */
  hint?: ReactNode;
  /**
   * Error message, linked with `aria-describedby`; sets `aria-invalid`. For an error of the
   * whole group, show it once at the `<fieldset>` and pass `aria-invalid` to each checkbox.
   */
  error?: ReactNode;
};

/**
 * Native checkbox with its label to the right. Several related checkboxes: put them in a
 * `<fieldset>` with a `<legend>`.
 */
export function Checkbox({
  label,
  hint,
  error,
  id,
  className,
  'aria-describedby': describedBy,
  'aria-invalid': ariaInvalid,
  ...rest
}: CheckboxProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const hasError = Boolean(error);
  const describedByIds =
    [hint ? hintId : '', hasError ? errorId : '', describedBy ?? '']
      .filter(Boolean)
      .join(' ') || undefined;
  return (
    <div className={cx(styles.checkbox, className)}>
      <input
        {...rest}
        id={inputId}
        type="checkbox"
        className={styles.input}
        aria-describedby={describedByIds}
        aria-invalid={hasError ? true : ariaInvalid}
      />
      <div className={styles.text}>
        <label htmlFor={inputId} className={styles.label}>
          {label}
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
      </div>
    </div>
  );
}
