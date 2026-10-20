import type { ComponentPropsWithRef } from 'react';
import {
  Link as RouterLink,
  type LinkProps as RouterLinkProps,
} from 'react-router';
import { cx } from '../../utils/cx/cx';
import { VisuallyHidden } from '../VisuallyHidden/VisuallyHidden';
import styles from './Link.module.scss';

type LinkOwnProps = {
  /** Open in a new tab (`target="_blank"`, `rel="noopener noreferrer"`) and say so to screen readers. */
  newTab?: boolean;
  /** Screen-reader text added when `newTab` is set. Default `(opens in a new tab)`. */
  newTabLabel?: string;
};

/** In-app link: react-router `to` (needs a router above it). */
export type RouterLinkVariantProps = RouterLinkProps &
  LinkOwnProps & { href?: never };
/** Plain link: `href` (another site, a file, `mailto:`, another app of the zone). */
export type AnchorLinkVariantProps = ComponentPropsWithRef<'a'> &
  LinkOwnProps & { href: string; to?: never };

export type LinkProps = RouterLinkVariantProps | AnchorLinkVariantProps;

/**
 * One link component for both kinds of link: `to` renders react-router's `<Link>` (client-side
 * navigation inside the app), `href` a plain `<a>` (full page load). Same look and focus ring.
 */
export function Link(props: LinkProps) {
  const { newTab = false, newTabLabel = '(opens in a new tab)' } = props;
  const tab = newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {};
  const content = (
    <>
      {props.children}
      {newTab ? <VisuallyHidden> {newTabLabel}</VisuallyHidden> : null}
    </>
  );
  if (props.to !== undefined) {
    const {
      newTab: _newTab,
      newTabLabel: _label,
      className,
      children: _children,
      ...rest
    } = props;
    return (
      <RouterLink {...rest} {...tab} className={cx(styles.link, className)}>
        {content}
      </RouterLink>
    );
  }
  const {
    newTab: _newTab,
    newTabLabel: _label,
    className,
    children: _children,
    ...rest
  } = props;
  return (
    <a {...rest} {...tab} className={cx(styles.link, className)}>
      {content}
    </a>
  );
}
