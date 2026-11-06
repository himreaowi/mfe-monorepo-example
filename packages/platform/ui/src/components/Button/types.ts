import type { ComponentPropsWithRef } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

/** Every native `<button>` attribute (and `ref`), plus: */
export type ButtonProps = ComponentPropsWithRef<'button'> & {
  /** Default `primary`. `danger` for destructive actions, `ghost` for low-emphasis ones. */
  variant?: ButtonVariant;
  /** Default `md`. */
  size?: ButtonSize;
  /**
   * Shows a spinner and ignores clicks (`aria-disabled`, so the button keeps focus). Change the
   * label too (`Saving…`): the spinner itself is decorative.
   */
  loading?: boolean;
};
