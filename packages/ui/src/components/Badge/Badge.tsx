import type { ComponentPropsWithRef } from 'react';
import { cx } from '../../utils/cx/cx';
import styles from './Badge.module.scss';

export type BadgeVariant =
  'neutral' | 'accent' | 'info' | 'success' | 'warning' | 'danger';

export type BadgeProps = ComponentPropsWithRef<'span'> & {
  /** Default `neutral`. Colour is never the only signal: the text says what the state is. */
  variant?: BadgeVariant;
};

/** Short status label (`Approved`, `3 new`). Static text: not a live region, not interactive. */
export function Badge({ variant = 'neutral', className, ...rest }: BadgeProps) {
  return (
    <span {...rest} className={cx(styles.badge, styles[variant], className)} />
  );
}
