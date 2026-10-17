import styles from './Button.module.scss';
import type { ButtonProps } from './types';

export function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  disabled,
  className: extraClassName,
  'aria-label': ariaLabel,
  'aria-pressed': ariaPressed,
}: ButtonProps) {
  const className = [
    styles.button,
    variant === 'secondary' ? styles.secondary : '',
    variant === 'ghost' ? styles.ghost : '',
    extraClassName,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={className}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
    >
      {children}
    </button>
  );
}
