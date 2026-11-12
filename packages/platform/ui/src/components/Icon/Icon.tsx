import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cx } from '../../utils/cx/cx';
import styles from './Icon.module.scss';

export type IconSize = 'sm' | 'md' | 'lg';
export type IconTone = 'default' | 'muted' | 'accent' | 'danger' | 'success';

export type IconProps = Omit<ComponentPropsWithRef<'svg'>, 'children'> & {
  /** `sm` 1rem, `md` 1.25rem, `lg` 1.5rem. Default: 1em (scales with the text around it). */
  size?: IconSize;
  /** Colour from the design tokens. Default: none, the icon follows the text colour. */
  tone?: IconTone;
  /**
   * What the icon means, when nothing else says it: `role="img"` + `aria-label`. Absent: the
   * icon is decorative (`aria-hidden="true"`); put the name on the button or text next to it.
   */
  label?: string;
  /** The shapes, drawn on a 24×24 grid with `currentColor` (see src/icons). */
  children?: ReactNode;
};

/**
 * The SVG wrapper every @org/ui icon is built on (`src/icons/<Name>Icon.tsx`). Draws with
 * `currentColor` (stroke by default; pass `fill="currentColor" stroke="none"` for filled
 * shapes), so it follows the text colour and the theme. Never focusable.
 */
export function Icon({
  size,
  tone,
  label,
  className,
  children,
  ...rest
}: IconProps) {
  const a11y = label
    ? { role: 'img', 'aria-label': label }
    : { 'aria-hidden': true as const };
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      {...a11y}
      {...rest}
      className={cx(
        styles.icon,
        size && styles[size],
        tone && styles[tone],
        className,
      )}
    >
      {children}
    </svg>
  );
}
