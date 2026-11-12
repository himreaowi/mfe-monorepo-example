import type {
  ComponentProps,
  ComponentPropsWithRef,
  ReactNode,
  Ref,
} from 'react';
import { CSPProvider } from '@base-ui/react/csp-provider';
import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { mergeProps } from '@base-ui/react/merge-props';
import { cx } from '../../utils/cx/cx';
import { CloseIcon } from '../../icons/CloseIcon';
import styles from './Dialog.module.scss';

export type DialogProps = Omit<
  ComponentPropsWithRef<'dialog'>,
  'open' | 'title' | 'onClose' | 'children'
> & {
  /** Shown as a modal while true. */
  open: boolean;
  /** Called when the dialog asks to close: Escape, the close button, `<form method="dialog">`. Set `open` to false. */
  onClose: () => void;
  /** Heading that names the dialog (`aria-labelledby`). */
  title: ReactNode;
  /** Short text that describes it (`aria-describedby`), shown under the title. */
  description?: ReactNode;
  children?: ReactNode;
  /** Row of actions at the bottom (e.g. Cancel + Confirm buttons). */
  footer?: ReactNode;
  /** Accessible name of the × button. Default `Close`. */
  closeLabel?: string;
  /** Maximum width. Default `md`. */
  size?: 'sm' | 'md' | 'lg';
};

/**
 * Modal dialog on Base UI Dialog, rendered as a `<dialog open>` element in a portal: a backdrop,
 * a focus trap (the rest of the page is inert), scroll lock and Escape to close; a click on the
 * backdrop does not close it. Focus goes to the first focusable element inside (or the one with
 * `autoFocus`) and back to the element that had it when the dialog closes. The element stays
 * mounted (hidden) while closed. No `<style>` elements (CSPProvider), so it works under the
 * strict CSP.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  closeLabel = 'Close',
  size = 'md',
  className,
  ref,
  ...rest
}: DialogProps) {
  return (
    <CSPProvider disableStyleElements>
      <BaseDialog.Root
        open={open}
        onOpenChange={(next) => {
          if (!next && open) onClose();
        }}
        disablePointerDismissal
      >
        <BaseDialog.Portal keepMounted>
          <BaseDialog.Backdrop className={styles.backdrop} />
          <BaseDialog.Popup
            // the rendered element is the <dialog> below
            ref={ref as Ref<HTMLDivElement>}
            render={(props, state) => (
              <dialog
                {...mergeProps<'dialog'>(
                  rest,
                  props as ComponentProps<'dialog'>,
                )}
                open={state.open}
                // `<form method="dialog">` closes the element natively
                onClose={() => {
                  if (open) onClose();
                }}
                className={cx(styles.dialog, styles[size], className)}
              />
            )}
          >
            <div className={styles.header}>
              <BaseDialog.Title className={styles.title}>
                {title}
              </BaseDialog.Title>
              <BaseDialog.Close
                className={styles.close}
                aria-label={closeLabel}
              >
                <CloseIcon size="md" />
              </BaseDialog.Close>
            </div>
            {description !== undefined ? (
              <BaseDialog.Description className={styles.description}>
                {description}
              </BaseDialog.Description>
            ) : null}
            {children !== undefined ? (
              <div className={styles.body}>{children}</div>
            ) : null}
            {footer !== undefined ? (
              <div className={styles.footer}>{footer}</div>
            ) : null}
          </BaseDialog.Popup>
        </BaseDialog.Portal>
      </BaseDialog.Root>
    </CSPProvider>
  );
}
