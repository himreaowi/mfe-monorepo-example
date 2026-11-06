import type { ReactNode } from 'react';

export type SkipLinkProps = {
  /** `id` of the element to focus, usually `<main>` (give it `tabIndex={-1}`). */
  targetId: string;
  /** Link text. Default `Skip to main content`. */
  children?: ReactNode;
  /** Extra class (e.g. to move it), added after the built-in one. */
  className?: string;
};
