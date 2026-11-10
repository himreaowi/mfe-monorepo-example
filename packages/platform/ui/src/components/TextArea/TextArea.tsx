import { Input } from '@base-ui/react/input';
import type { ComponentPropsWithRef } from 'react';
import { cx } from '../../utils/cx/cx';
import { Field, type FieldLabelProps } from '../Field/Field';
import styles from './TextArea.module.scss';

export type TextAreaProps = ComponentPropsWithRef<'textarea'> &
  FieldLabelProps & {
    /** Class of the `<textarea>` (`className` goes on the wrapper). */
    textAreaClassName?: string;
  };

/** Multi-line text input (Base UI Input rendering a `<textarea>`) with label, hint and error (see Field). Default 4 rows. */
export function TextArea({
  label,
  hint,
  error,
  required,
  id,
  className,
  textAreaClassName,
  rows = 4,
  'aria-describedby': describedBy,
  ...rest
}: TextAreaProps) {
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
        <Input
          {...control}
          render={<textarea {...rest} rows={rows} />}
          className={cx(styles.textArea, textAreaClassName)}
        />
      )}
    </Field>
  );
}
