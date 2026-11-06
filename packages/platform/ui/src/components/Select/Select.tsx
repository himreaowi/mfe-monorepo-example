import type { ComponentPropsWithRef } from 'react';
import { cx } from '../../utils/cx/cx';
import { Field, type FieldLabelProps } from '../Field/Field';
import styles from './Select.module.scss';

export type SelectOption = { value: string; label: string; disabled?: boolean };

export type SelectProps = ComponentPropsWithRef<'select'> &
  FieldLabelProps & {
    /** The choices (or pass `<option>`/`<optgroup>` children). */
    options?: SelectOption[];
    /** First, empty choice (`value=""`), e.g. `Choose a type`. */
    placeholder?: string;
    /** Class of the `<select>` (`className` goes on the wrapper). */
    selectClassName?: string;
  };

/** Native `<select>` with label, hint and error (see Field). */
export function Select({
  label,
  hint,
  error,
  required,
  id,
  className,
  selectClassName,
  options,
  placeholder,
  children,
  'aria-describedby': describedBy,
  ...rest
}: SelectProps) {
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      id={id}
      describedBy={describedBy}
      className={className}
    >
      {(control) => (
        <select
          {...rest}
          {...control}
          className={cx(styles.select, selectClassName)}
        >
          {placeholder !== undefined ? (
            <option value="">{placeholder}</option>
          ) : null}
          {options?.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
          {children}
        </select>
      )}
    </Field>
  );
}
