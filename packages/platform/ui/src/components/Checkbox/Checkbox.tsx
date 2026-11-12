import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox';
import {
  useId,
  type ComponentPropsWithRef,
  type FormEventHandler,
  type ReactNode,
} from 'react';
import { cx } from '../../utils/cx/cx';
import { VisuallyHidden } from '../VisuallyHidden/VisuallyHidden';
import { CheckIcon } from '../../icons/CheckIcon';
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
 * Base UI Checkbox (`role="checkbox"` on a focusable `<span>`, plus a hidden native
 * `<input type="checkbox">` that carries `name`/`value` into the form) with its label to the
 * right. `ref` is that hidden `<input>`; `onChange` gets its change event (`event.target.checked`).
 * Several related checkboxes: put them in a `<fieldset>` with a `<legend>`.
 */
export function Checkbox({
  label,
  hint,
  error,
  id,
  className,
  ref,
  name,
  value,
  checked,
  defaultChecked,
  disabled,
  required,
  readOnly,
  form,
  onChange,
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
    // The hidden input's React change event bubbles here: `onChange` keeps its native shape.
    <div
      className={cx(styles.checkbox, className)}
      onChange={onChange as FormEventHandler<HTMLDivElement> | undefined}
    >
      <BaseCheckbox.Root
        {...(rest as BaseCheckbox.Root.Props)}
        id={inputId}
        inputRef={ref}
        name={name}
        value={value === undefined ? undefined : String(value)}
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled}
        required={required}
        readOnly={readOnly}
        form={form}
        className={styles.input}
        aria-describedby={describedByIds}
        aria-invalid={hasError ? true : ariaInvalid}
      >
        <BaseCheckbox.Indicator className={styles.indicator}>
          <CheckIcon className={styles.tick} />
        </BaseCheckbox.Indicator>
      </BaseCheckbox.Root>
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
