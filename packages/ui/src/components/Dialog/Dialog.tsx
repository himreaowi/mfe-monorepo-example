import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type ComponentPropsWithRef,
  type ReactNode,
  type Ref,
} from 'react';
import { cx } from '../../utils/cx/cx';
import styles from './Dialog.module.scss';

export type DialogProps = Omit<
  ComponentPropsWithRef<'dialog'>,
  'open' | 'title' | 'onClose' | 'children'
> & {
  /** Shown as a modal (`showModal()`) while true. */
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
 * Modal dialog on the native `<dialog>` element: `showModal()` gives the top layer, the
 * backdrop, a focus trap (the rest of the page is inert) and Escape to close. Focus goes to
 * the first focusable element inside (or the one with `autoFocus`) and back to the element
 * that had it when the dialog closes. No inline styles; works under the strict CSP.
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
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  const setRef = useCallback(
    (node: HTMLDialogElement | null) => {
      dialogRef.current = node;
      assignRef(ref, node);
    },
    [ref],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleClose = () => {
    const target = returnFocusRef.current;
    returnFocusRef.current = null;
    if (target?.isConnected) target.focus();
    if (open) onClose();
  };

  return (
    <dialog
      {...rest}
      ref={setRef}
      className={cx(styles.dialog, styles[size], className)}
      aria-labelledby={titleId}
      aria-describedby={description !== undefined ? descriptionId : undefined}
      onClose={handleClose}
    >
      <div className={styles.header}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <button
          type="button"
          className={styles.close}
          aria-label={closeLabel}
          onClick={() => dialogRef.current?.close()}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
      {description !== undefined ? (
        <p id={descriptionId} className={styles.description}>
          {description}
        </p>
      ) : null}
      {children !== undefined ? (
        <div className={styles.body}>{children}</div>
      ) : null}
      {footer !== undefined ? (
        <div className={styles.footer}>{footer}</div>
      ) : null}
    </dialog>
  );
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}
