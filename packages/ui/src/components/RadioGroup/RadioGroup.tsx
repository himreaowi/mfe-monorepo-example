import { useId, type ChangeEvent, type ReactNode } from 'react';
import { cx } from '../../utils/cx/cx';
import { VisuallyHidden } from '../VisuallyHidden/VisuallyHidden';
import styles from './RadioGroup.module.scss';

export type RadioOption = {
  value: string;
  label: ReactNode;
  /** Help text under this option. */
  hint?: ReactNode;
  disabled?: boolean;
};

export type RadioGroupProps = {
  /** The question, rendered as the `<legend>` that names the group. */
  label: ReactNode;
  options: RadioOption[];
  /** Shared `name` of the radios. Default: generated. */
  name?: string;
  /** Selected value (controlled). */
  value?: string;
  /** Initially selected value (uncontrolled). */
  defaultValue?: string;
  onChange?: (value: string, event: ChangeEvent<HTMLInputElement>) => void;
  /** Help text under the legend. */
  hint?: ReactNode;
  /** Error message under the hint; the radios get `aria-invalid`. */
  error?: ReactNode;
  /** Sets `required` on the radios and shows `(required)` after the legend. */
  required?: boolean;
  disabled?: boolean;
  /** Options side by side instead of stacked (short labels only). */
  inline?: boolean;
  /** Class of the `<fieldset>`. */
  className?: string;
  /** `id` of the `<fieldset>`. */
  id?: string;
};

/**
 * Native radio buttons in a `<fieldset>` with a `<legend>`: the browser provides the arrow-key
 * behaviour and screen readers announce the group name and position.
 */
export function RadioGroup({
  label,
  options,
  name,
  value,
  defaultValue,
  onChange,
  hint,
  error,
  required,
  disabled,
  inline = false,
  className,
  id,
}: RadioGroupProps) {
  const baseId = useId();
  const groupName = name ?? baseId;
  const hintId = `${baseId}-hint`;
  const errorId = `${baseId}-error`;
  const hasError = Boolean(error);
  const describedBy =
    [hint ? hintId : '', hasError ? errorId : ''].filter(Boolean).join(' ') ||
    undefined;
  return (
    <fieldset
      id={id}
      className={cx(styles.group, className)}
      aria-describedby={describedBy}
      disabled={disabled}
    >
      <legend className={styles.legend}>
        {label}
        {required ? <span className={styles.required}> (required)</span> : null}
      </legend>
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
      <div className={cx(styles.options, inline && styles.inline)}>
        {options.map((option, index) => {
          const optionId = `${baseId}-${index}`;
          const optionHintId = `${optionId}-hint`;
          return (
            <div key={option.value} className={styles.option}>
              <input
                id={optionId}
                type="radio"
                className={styles.input}
                name={groupName}
                value={option.value}
                disabled={option.disabled}
                required={required}
                aria-invalid={hasError ? true : undefined}
                aria-describedby={option.hint ? optionHintId : undefined}
                {...(value !== undefined
                  ? { checked: value === option.value }
                  : { defaultChecked: defaultValue === option.value })}
                onChange={(event) => onChange?.(option.value, event)}
              />
              <div className={styles.text}>
                <label htmlFor={optionId} className={styles.label}>
                  {option.label}
                </label>
                {option.hint ? (
                  <p id={optionHintId} className={styles.hint}>
                    {option.hint}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
