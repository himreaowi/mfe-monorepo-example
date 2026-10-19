import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { flushSync } from 'react-dom';

/**
 * `wide`: everything fits in one row (e.g. brand, nav and actions in a header). `compact`: it
 * does not; the layout shows a "Menu" button and puts the rest in a disclosure panel.
 * `undefined` until measured (and without ResizeObserver): the layout's CSS breakpoint decides.
 */
export type FitLayout = 'wide' | 'compact';

/**
 * Extra room (px) the row needs before a compact layout becomes wide again. Switching changes
 * the header height, which can add or remove the page scrollbar and so change the available
 * width by its size: without a margin the layout could flip back and forth at the threshold.
 */
export const FIT_HYSTERESIS_PX = 24;

/**
 * Pure decision: compact as soon as the row does not fit; back to wide only when it fits with
 * `hysteresis` px to spare.
 */
export function decideFitLayout(
  required: number,
  available: number,
  current: FitLayout | undefined,
  hysteresis = FIT_HYSTERESIS_PX,
): FitLayout {
  if (required > available) return 'compact';
  if (current === 'compact' && required > available - hysteresis) {
    return 'compact';
  }
  return 'wide';
}

/**
 * Width the container needs for one row. Switches it to `data-layout="measure"` (the layout's
 * CSS: `width: max-content`, nothing wraps, the panel laid out as a row even when collapsed),
 * reads the width and restores the attribute in the same task, so the measuring layout is
 * never painted.
 */
export function measureFit(container: HTMLElement): {
  required: number;
  available: number;
} {
  const available = container.getBoundingClientRect().width;
  const previous = container.getAttribute('data-layout');
  container.setAttribute('data-layout', 'measure');
  const required = Math.ceil(container.getBoundingClientRect().width);
  if (previous === null) container.removeAttribute('data-layout');
  else container.setAttribute('data-layout', previous);
  return { required, available: Math.floor(available) };
}

export type FitLayoutOptions = {
  /** The row (e.g. `<header>`); gets `data-layout="measure"` while being measured. */
  container: RefObject<HTMLElement | null>;
  /**
   * Zero-height element spanning the container (`position: absolute; left: 0; right: 0;
   * height: 0`): its width is the available width only, so the container's own height changes
   * never re-trigger the measurement.
   */
  sizer: RefObject<HTMLElement | null>;
  /** The collapsible panel (focus inside it moves to `button` when it collapses). */
  panel: RefObject<HTMLElement | null>;
  /** The "Menu" button that shows the panel in the compact layout. */
  button: RefObject<HTMLButtonElement | null>;
  /** The panel is open (an open compact panel is not re-measured). */
  open: boolean;
  /** Called after every change (e.g. close the panel when the layout becomes wide). */
  onChange?: (layout: FitLayout) => void;
};

/**
 * Measures whether a row (a header: brand, nav, actions) fits, so a layout can collapse it
 * behind a "Menu" button when it does not (not at a fixed breakpoint). Returns the layout; put
 * it on the container as `data-layout` and style `wide`, `compact` and `measure` in CSS.
 *
 * - measured before the first paint (`useLayoutEffect`) and again whenever the available width
 *   changes (ResizeObserver on a zero-height sizer, so our own height changes never re-trigger
 *   it), the container's content changes (MutationObserver: sign-in, nav items) or web fonts load;
 * - updates are committed synchronously (`flushSync`) inside the observer callbacks, so the
 *   wrong layout is never painted;
 * - an open compact panel is not re-measured (its contents are laid out as a column); it is
 *   measured again when it closes;
 * - without ResizeObserver (old browsers, jsdom) it stays `undefined` and the CSS breakpoint
 *   applies;
 * - collapsing while focus is inside the panel moves focus to the button.
 */
export function useFitLayout(options: FitLayoutOptions): FitLayout | undefined {
  const { open } = options;
  const [layout, setLayout] = useState<FitLayout>();
  const layoutRef = useRef<FitLayout | undefined>(undefined);
  const openRef = useRef(open);
  const optionsRef = useRef(options);

  useLayoutEffect(() => {
    openRef.current = open;
    optionsRef.current = options;
  });

  const update = useCallback((sync: boolean) => {
    const { container, panel, button } = optionsRef.current;
    const element = container.current;
    if (!element) return;
    if (openRef.current && layoutRef.current === 'compact') return;
    const { required, available } = measureFit(element);
    const next = decideFitLayout(required, available, layoutRef.current);
    if (next === layoutRef.current) return;
    const focusInPanel =
      next === 'compact' &&
      panel.current !== null &&
      panel.current.contains(document.activeElement);
    layoutRef.current = next;
    const apply = () => {
      setLayout(next);
      optionsRef.current.onChange?.(next);
    };
    if (sync) flushSync(apply);
    else apply();
    // the panel is about to be hidden: keep focus on the control that reveals it
    if (focusInPanel) button.current?.focus();
  }, []);

  useLayoutEffect(() => {
    const container = optionsRef.current.container.current;
    const sizer = optionsRef.current.sizer.current;
    if (!container || typeof ResizeObserver === 'undefined') return undefined;
    update(false);
    let active = true;
    const resize = new ResizeObserver(() => {
      if (active) update(true);
    });
    if (sizer) resize.observe(sizer);
    const mutation = new MutationObserver(() => {
      if (active) update(true);
    });
    mutation.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    void document.fonts?.ready.then(() => {
      if (active) update(true);
    });
    return () => {
      active = false;
      resize.disconnect();
      mutation.disconnect();
    };
  }, [update]);

  // a closed panel can be measured again (content may have changed while it was open)
  useLayoutEffect(() => {
    if (!open && typeof ResizeObserver !== 'undefined') update(false);
  }, [open, update]);

  return layout;
}
