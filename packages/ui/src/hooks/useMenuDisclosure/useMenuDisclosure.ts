import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { Dispatch, MouseEvent, RefObject, SetStateAction } from 'react';

/** Spread on the toggle `<button>`. */
export type MenuButtonProps = {
  ref: RefObject<HTMLButtonElement | null>;
  type: 'button';
  'aria-expanded': boolean;
  'aria-controls': string;
  onClick: () => void;
};

/** Spread on the panel (the element the button shows and hides). */
export type MenuPanelProps<TPanel extends HTMLElement> = {
  ref: RefObject<TPanel | null>;
  id: string;
  onClick: (event: MouseEvent<TPanel>) => void;
};

export type MenuDisclosure<
  TPanel extends HTMLElement = HTMLDivElement,
  TContainer extends HTMLElement = HTMLElement,
> = {
  /** The panel is open. Render it hidden (`display: none`) while closed. */
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  toggle: () => void;
  /**
   * Close it. Focus moves to the button when `restoreFocus` is true, and always when focus was
   * inside the panel (which is about to be hidden).
   */
  close: (restoreFocus?: boolean) => void;
  /**
   * Optional: the element around button and panel (e.g. `<header>`). A pointer down inside it
   * does not close the panel; without it, only button and panel count as inside.
   */
  containerRef: RefObject<TContainer | null>;
  buttonRef: RefObject<HTMLButtonElement | null>;
  panelRef: RefObject<TPanel | null>;
  panelId: string;
  buttonProps: MenuButtonProps;
  panelProps: MenuPanelProps<TPanel>;
};

/**
 * Headless disclosure for a collapsible menu, drawer or dropdown panel: state plus the props
 * and listeners for the WAI-ARIA disclosure pattern. Markup and styles stay in the layout.
 *
 * - the button gets `aria-expanded` and `aria-controls` (the panel's generated `id`);
 * - **Escape** closes it and returns focus to the button;
 * - a **pointer down outside** (`containerRef`, or button + panel) closes it, focus stays
 *   where the user put it;
 * - a **followed link inside the panel** (click on `a[href]`, i.e. a client-side navigation)
 *   and **browser back/forward** (`popstate`) close it;
 * - closing while focus is inside the panel moves focus to the button (never lost on `<body>`).
 *
 * The listeners are only attached while the panel is open.
 */
export function useMenuDisclosure<
  TPanel extends HTMLElement = HTMLDivElement,
  TContainer extends HTMLElement = HTMLElement,
>(): MenuDisclosure<TPanel, TContainer> {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const containerRef = useRef<TContainer>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<TPanel>(null);

  const close = useCallback((restoreFocus = false) => {
    const panel = panelRef.current;
    const focusInside =
      panel !== null && panel.contains(document.activeElement);
    setOpen(false);
    if (restoreFocus || focusInside) buttonRef.current?.focus();
  }, []);

  const toggle = useCallback(() => setOpen((value) => !value), []);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(true);
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      const inside = [
        containerRef.current,
        buttonRef.current,
        panelRef.current,
      ].some(
        (element) =>
          element !== null && target !== null && element.contains(target),
      );
      if (!inside) close(false);
    };
    const onPopState = () => close(false);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('popstate', onPopState);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('popstate', onPopState);
    };
  }, [open, close]);

  // click delegation only: links inside handle keyboard activation themselves (Enter = click)
  const onPanelClick = (event: MouseEvent<TPanel>) => {
    if (open && (event.target as Element).closest('a[href]')) close(false);
  };

  return {
    open,
    setOpen,
    toggle,
    close,
    containerRef,
    buttonRef,
    panelRef,
    panelId,
    buttonProps: {
      ref: buttonRef,
      type: 'button',
      'aria-expanded': open,
      'aria-controls': panelId,
      onClick: toggle,
    },
    panelProps: { ref: panelRef, id: panelId, onClick: onPanelClick },
  };
}
