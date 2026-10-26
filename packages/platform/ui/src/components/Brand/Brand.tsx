import styles from './Brand.module.scss';
import type { BrandProps } from './types';

/**
 * The app name in a header: always ONE line. A name longer than the space it gets is truncated
 * with an ellipsis on screen only; the DOM text stays whole, so screen readers and the
 * accessible name of a brand link get the full name (no visually hidden copy, no `title`
 * tooltip: see the README). Show the full name elsewhere too (home page `<h1>`, document title).
 *
 * Typography, colour and flex sizing come from the layout (`className`): the layout decides
 * how much room the brand gets; give it `flex: 0 1 auto` so it is the item that shrinks first.
 */
export function Brand({ className, children, ...rest }: BrandProps) {
  return (
    <div
      {...rest}
      className={className ? `${styles.brand} ${className}` : styles.brand}
    >
      {children}
    </div>
  );
}
