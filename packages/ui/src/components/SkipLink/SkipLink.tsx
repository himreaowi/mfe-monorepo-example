import type { MouseEvent } from 'react';
import styles from './SkipLink.module.scss';
import type { SkipLinkProps } from './types';

/**
 * "Skip to main content": render it as the first focusable element of a layout. Visually
 * hidden (clipped, out of the flow, so no pixel of the layout changes) until it has keyboard
 * focus, then shown over the top-left corner. Activating it focuses the target without a
 * `#fragment` URL change (that would be a router navigation); the `href` stays for "copy link"
 * and for when scripts have not run.
 */
export function SkipLink({
  targetId,
  children = 'Skip to main content',
  className,
}: SkipLinkProps) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    document.getElementById(targetId)?.focus();
  };
  return (
    <a
      href={`#${targetId}`}
      className={
        className ? `${styles.skipLink} ${className}` : styles.skipLink
      }
      onClick={onClick}
    >
      {children}
    </a>
  );
}
