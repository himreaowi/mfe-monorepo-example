import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  type ComponentPropsWithoutRef,
  type MouseEvent,
  type ReactElement,
  type Ref,
  type RefObject,
} from 'react';
import { Collapsible } from '@base-ui/react/collapsible';
import { CSPProvider } from '@base-ui/react/csp-provider';

type MenuContext = {
  open: boolean;
  panelId: string;
  buttonRef: RefObject<HTMLButtonElement | null>;
  panelRef: RefObject<HTMLDivElement | null>;
  close: (restoreFocus?: boolean) => void;
};

const Context = createContext<MenuContext | null>(null);

function useMenuContext(part: string): MenuContext {
  const context = useContext(Context);
  if (!context)
    throw new Error(
      `MenuDisclosure.${part} must be inside MenuDisclosure.Root`,
    );
  return context;
}

/** One callback ref that sets every given ref (a caller's ref plus the internal one). */
function mergeRefs<T>(
  ...refs: (Ref<T> | undefined)[]
): (node: T | null) => void {
  return (node) => {
    for (const ref of refs) {
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    }
  };
}

export type MenuDisclosureRootProps = Omit<
  ComponentPropsWithoutRef<'div'>,
  'onChange'
> & {
  /** The panel is open (controlled: the layout also needs it, e.g. for `useFitLayout`). */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Element to render instead of a `<div>`, e.g. `<header />`. */
  render?: ReactElement;
  /** The rendered element (the "container": a pointer down inside it never closes the panel). */
  ref?: Ref<HTMLElement>;
};

/**
 * Non-modal disclosure for a collapsible menu, drawer or dropdown panel (WAI-ARIA disclosure
 * pattern) on Base UI Collapsible. Root wraps Button and Panel (render it as the `<header>`).
 *
 * - Button gets `type="button"`, `aria-expanded` and `aria-controls` (the panel's id);
 * - **Escape** closes it and returns focus to the button;
 * - a **pointer down outside** Root closes it, focus stays where the user put it;
 * - a **followed link in the panel** (click on `a[href]`) and **back/forward** (`popstate`)
 *   close it;
 * - a **click on a control marked `data-menu-close`** in the panel closes it (e.g. Sign out);
 * - closing while focus is in the panel moves focus to the button (never lost on `<body>`).
 *
 * The listeners are only attached while open. The panel stays mounted and never gets `hidden`:
 * the layout's CSS hides it while closed (it may show it inline when the layout is wide).
 * No `<style>` elements (CSPProvider), so it works under the strict CSP.
 */
function Root({
  open,
  onOpenChange,
  render,
  ref,
  children,
  ...rest
}: MenuDisclosureRootProps) {
  const panelId = useId();
  const rootRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const onOpenChangeRef = useRef(onOpenChange);
  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  });

  const close = useCallback((restoreFocus = false) => {
    const panel = panelRef.current;
    const focusInside =
      panel !== null && panel.contains(document.activeElement);
    onOpenChangeRef.current(false);
    if (restoreFocus || focusInside) buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(true);
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target === null || !rootRef.current?.contains(target)) close(false);
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

  const context = useMemo(
    () => ({ open, panelId, buttonRef, panelRef, close }),
    [open, panelId, close],
  );
  const mergedRef = useMemo(() => mergeRefs(ref, rootRef), [ref]);

  return (
    <CSPProvider disableStyleElements>
      <Context.Provider value={context}>
        <Collapsible.Root
          {...rest}
          ref={mergedRef as Ref<HTMLDivElement>}
          open={open}
          onOpenChange={(next) => onOpenChange(next)}
          render={render}
        >
          {children}
        </Collapsible.Root>
      </Context.Provider>
    </CSPProvider>
  );
}

export type MenuDisclosureButtonProps = Omit<
  ComponentPropsWithoutRef<'button'>,
  'type' | 'aria-expanded' | 'aria-controls'
> & { ref?: Ref<HTMLButtonElement> };

/** The toggle `<button>` (name it, e.g. "Menu"). */
function Button({ ref, ...rest }: MenuDisclosureButtonProps) {
  const { panelId, buttonRef } = useMenuContext('Button');
  const mergedRef = useMemo(() => mergeRefs(ref, buttonRef), [ref, buttonRef]);
  // Base UI sets aria-controls only while open; the disclosure pattern keeps it.
  return (
    <Collapsible.Trigger {...rest} ref={mergedRef} aria-controls={panelId} />
  );
}

export type MenuDisclosurePanelProps = Omit<
  ComponentPropsWithoutRef<'div'>,
  'id' | 'hidden'
> & { ref?: Ref<HTMLDivElement> };

/** The panel the button shows and hides. Always mounted; hide it with CSS while closed. */
function Panel({ ref, onClick, ...rest }: MenuDisclosurePanelProps) {
  const { open, panelId, panelRef, close } = useMenuContext('Panel');
  const mergedRef = useMemo(() => mergeRefs(ref, panelRef), [ref, panelRef]);
  // click delegation only: links and buttons handle keyboard activation themselves (Enter = click)
  const onPanelClick = (event: MouseEvent<HTMLDivElement>) => {
    onClick?.(event);
    const target = event.target as Element;
    if (open && target.closest('a[href], [data-menu-close]')) close(false);
  };
  return (
    <Collapsible.Panel
      {...rest}
      ref={mergedRef}
      id={panelId}
      keepMounted
      onClick={onPanelClick}
      // no `hidden`: the layout's CSS decides (the panel may be shown inline when wide)
      render={(props) => <div {...props} hidden={undefined} />}
    />
  );
}

export const MenuDisclosure = { Root, Button, Panel };
