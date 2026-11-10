import { Fieldset } from '@base-ui/react/fieldset';
import { Radio } from '@base-ui/react/radio';
import { RadioGroup as BaseRadioGroup } from '@base-ui/react/radio-group';
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
  /** Class of the group element. */
  className?: string;
  /** `id` of the group element. */
  id?: string;
};

/**
 * Base UI RadioGroup + Radio, named by its legend (Base UI Fieldset): `role="radiogroup"` with
 * one tab stop and arrow keys that move and select. Each radio is a focusable `<span
 * role="radio">` with a hidden native radio beside it that carries `name`/`value` into the form.
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
    <Fieldset.Root
      id={id}
      className={cx(styles.group, className)}
      aria-describedby={describedBy}
      disabled={disabled}
      render={
        <BaseRadioGroup
          name={groupName}
          required={required}
          disabled={disabled}
          {...(value !== undefined ? { value } : { defaultValue })}
        />
      }
    >
      <Fieldset.Legend className={styles.legend}>
        {label}
        {required ? <span className={styles.required}> (required)</span> : null}
      </Fieldset.Legend>
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
            // The hidden radio's React change event bubbles here (click, arrow keys, label).
            <div
              key={option.value}
              className={styles.option}
              onChange={(event) =>
                onChange?.(
                  option.value,
                  event as unknown as ChangeEvent<HTMLInputElement>,
                )
              }
            >
              <Radio.Root
                id={optionId}
                value={option.value}
                disabled={option.disabled}
                className={styles.input}
                aria-invalid={hasError ? true : undefined}
                aria-describedby={option.hint ? optionHintId : undefined}
              >
                <Radio.Indicator className={styles.indicator} />
              </Radio.Root>
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
    </Fieldset.Root>
  );
}
