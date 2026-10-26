import type { ComponentPropsWithRef } from 'react';
import { cx } from '../../utils/cx/cx';
import { Field, type FieldLabelProps } from '../Field/Field';
import styles from './DateField.module.scss';

export type DateFieldProps = Omit<ComponentPropsWithRef<'input'>, 'type'> &
  FieldLabelProps & {
    /** Class of the `<input>` (`className` goes on the wrapper). */
    inputClassName?: string;
  };

/**
 * Native date input (`<input type="date">`): the browser's own, accessible date picker and
 * keyboard entry. `value`, `min` and `max` are ISO dates (`2026-10-21`).
 */
export function DateField({
  label,
  hint,
  error,
  required,
  id,
  className,
  inputClassName,
  'aria-describedby': describedBy,
  ...rest
}: DateFieldProps) {
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
        <input
          {...rest}
          {...control}
          type="date"
          className={cx(styles.input, inputClassName)}
        />
      )}
    </Field>
  );
}
