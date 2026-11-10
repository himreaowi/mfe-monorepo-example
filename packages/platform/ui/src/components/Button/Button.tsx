import { Button as BaseButton } from '@base-ui/react/button';
import { cx } from '../../utils/cx/cx';
import { Spinner } from '../Spinner/Spinner';
import styles from './Button.module.scss';
import type { ButtonProps } from './types';

/**
 * Native `<button>` via Base UI Button (default `type="button"`, so it never submits a form by
 * accident). `disabled` is the native attribute (not focusable). `loading` keeps the button
 * focusable (`aria-disabled`, Base UI `focusableWhenDisabled`) instead, which would otherwise
 * drop keyboard focus to the page, and ignores clicks and key presses.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  type = 'button',
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <BaseButton
      {...rest}
      type={type}
      disabled={disabled || loading}
      focusableWhenDisabled={loading && !disabled}
      className={cx(
        styles.button,
        variant !== 'primary' && styles[variant],
        size !== 'md' && styles[size],
        loading && styles.loading,
        className,
      )}
    >
      {loading ? <Spinner size="sm" decorative /> : null}
      {children}
    </BaseButton>
  );
}
