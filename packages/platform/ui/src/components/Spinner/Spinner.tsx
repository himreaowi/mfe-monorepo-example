import type { ComponentPropsWithRef } from 'react';
import { cx } from '../../utils/cx/cx';
import styles from './Spinner.module.scss';

export type SpinnerProps = Omit<ComponentPropsWithRef<'span'>, 'children'> & {
  /** What is loading; read by screen readers (`role="status"`). Default `Loading…`. */
  label?: string;
  /** Show the label next to the spinner instead of only to screen readers. */
  labelVisible?: boolean;
  /** Default `md`. */
  size?: 'sm' | 'md' | 'lg';
  /** Inside something that already says it is busy (e.g. a loading Button): no role, no label. */
  decorative?: boolean;
};

/**
 * Loading indicator. A `role="status"` region announces `label` politely; the ring is
 * `aria-hidden`. With `prefers-reduced-motion: reduce` it does not spin.
 */
export function Spinner({
  label = 'Loading…',
  labelVisible = false,
  size = 'md',
  decorative = false,
  className,
  ...rest
}: SpinnerProps) {
  const ring = (
    <span className={cx(styles.ring, styles[size])} aria-hidden="true" />
  );
  if (decorative) {
    return (
      <span
        {...rest}
        className={cx(styles.spinner, className)}
        aria-hidden="true"
      >
        {ring}
      </span>
    );
  }
  return (
    <span {...rest} role="status" className={cx(styles.spinner, className)}>
      {ring}
      <span className={labelVisible ? styles.label : styles.visuallyHidden}>
        {label}
      </span>
    </span>
  );
}
