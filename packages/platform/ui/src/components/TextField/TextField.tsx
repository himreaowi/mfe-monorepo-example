import type { ComponentPropsWithRef } from 'react';
import { cx } from '../../utils/cx/cx';
import { Field, type FieldLabelProps } from '../Field/Field';
import styles from './TextField.module.scss';

export type TextFieldProps = Omit<ComponentPropsWithRef<'input'>, 'type'> &
  FieldLabelProps & {
    /** Default `text`. Dates: DateField; choices: Select, Checkbox, RadioGroup. */
    type?: 'text' | 'email' | 'password' | 'search' | 'tel' | 'url' | 'number';
    /** Class of the `<input>` (`className` goes on the wrapper). */
    inputClassName?: string;
  };

/** Single-line text input with label, hint and error (see Field). `ref` is the `<input>`. */
export function TextField({
  label,
  hint,
  error,
  required,
  id,
  className,
  inputClassName,
  type = 'text',
  'aria-describedby': describedBy,
  ...rest
}: TextFieldProps) {
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
          type={type}
          className={cx(styles.input, inputClassName)}
        />
      )}
    </Field>
  );
}
