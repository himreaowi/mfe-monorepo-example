import type { ComponentPropsWithRef } from 'react';
import { cx } from '../../utils/cx/cx';
import styles from './VisuallyHidden.module.scss';

export type VisuallyHiddenProps = ComponentPropsWithRef<'span'>;

/** Text for screen readers only (e.g. `<VisuallyHidden>Error: </VisuallyHidden>`). */
export function VisuallyHidden({ className, ...rest }: VisuallyHiddenProps) {
  return <span {...rest} className={cx(styles.visuallyHidden, className)} />;
}
