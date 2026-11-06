import type { MouseEvent } from 'react';
import { cx } from '../../utils/cx/cx';
import { Spinner } from '../Spinner/Spinner';
import styles from './Button.module.scss';
import type { ButtonProps } from './types';

/**
 * Native `<button>` (default `type="button"`, so it never submits a form by accident).
 * `loading` keeps the button focusable (`aria-disabled`) instead of `disabled`, which would drop
 * keyboard focus to the page.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  type = 'button',
  className,
  children,
  onClick,
  'aria-disabled': ariaDisabled,
  ...rest
}: ButtonProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (loading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };
  return (
    <button
      {...rest}
      type={type}
      className={cx(
        styles.button,
        variant !== 'primary' && styles[variant],
        size !== 'md' && styles[size],
        loading && styles.loading,
        className,
      )}
      aria-disabled={loading ? true : ariaDisabled}
      onClick={handleClick}
    >
      {loading ? <Spinner size="sm" decorative /> : null}
      {children}
    </button>
  );
}
