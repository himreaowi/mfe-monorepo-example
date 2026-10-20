import type {
  ComponentPropsWithoutRef,
  ElementType,
  ReactNode,
  Ref,
} from 'react';
import { cx } from '../../utils/cx/cx';
import styles from './Card.module.scss';

type CardElement = 'div' | 'section' | 'article' | 'li';

export type CardProps = Omit<ComponentPropsWithoutRef<'div'>, 'title'> & {
  ref?: Ref<HTMLElement>;
  /** Element to render. Default `div`; `li` inside a list of cards, `article`/`section` for landmarks. */
  as?: CardElement;
  /** Optional heading at the top. */
  title?: ReactNode;
  /** Heading level of `title` (fits the page outline). Default 2. */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  /** Optional row at the bottom (actions, links). */
  footer?: ReactNode;
};

/** Surface with a border: groups related content. Not clickable itself (put a Link or Button inside). */
export function Card({
  as = 'div',
  title,
  headingLevel = 2,
  footer,
  className,
  children,
  ...rest
}: CardProps) {
  const Element = as as ElementType;
  const Heading = `h${headingLevel}` as const;
  return (
    <Element {...rest} className={cx(styles.card, className)}>
      {title !== undefined ? (
        <Heading className={styles.title}>{title}</Heading>
      ) : null}
      {children}
      {footer !== undefined ? (
        <div className={styles.footer}>{footer}</div>
      ) : null}
    </Element>
  );
}
