import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cx } from '../../utils/cx/cx';
import styles from './Alert.module.scss';

export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

export type AlertProps = Omit<ComponentPropsWithRef<'div'>, 'title'> & {
  /** Default `info`. */
  variant?: AlertVariant;
  /** Short heading (e.g. `There is a problem`). Recommended: colour alone does not say what kind it is. */
  title?: ReactNode;
  /**
   * Announce it when it appears (default true): `role="alert"` (assertive) for `error` and
   * `warning`, `role="status"` (polite) for `info` and `success`. Set `false` for a message
   * that is part of the page from the start; pass `role` to override.
   */
  live?: boolean;
};

/** Message box for feedback: info, success, warning or error. */
export function Alert({
  variant = 'info',
  title,
  live = true,
  className,
  children,
  role,
  ...rest
}: AlertProps) {
  const liveRole =
    variant === 'error' || variant === 'warning' ? 'alert' : 'status';
  return (
    <div
      {...rest}
      role={role ?? (live ? liveRole : undefined)}
      className={cx(styles.alert, styles[variant], className)}
    >
      {title !== undefined ? <p className={styles.title}>{title}</p> : null}
      <div className={styles.body}>{children}</div>
    </div>
  );
}
