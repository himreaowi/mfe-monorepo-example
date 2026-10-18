import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { flushSync } from 'react-dom';

/**
 * `wide`: brand, nav and actions in one header row. `compact`: brand + "Menu" button, the rest
 * in the disclosure panel. `undefined` until measured (and without ResizeObserver): the CSS
 * breakpoint (40rem) decides.
 */
export type HeaderLayout = 'wide' | 'compact';

/**
 * Extra room (px) the row needs before a compact header becomes wide again. Switching changes
 * the header height, which can add or remove the page scrollbar and so change the available
 * width by its size: without a margin the header could flip back and forth at the threshold.
 */
export const HEADER_HYSTERESIS_PX = 24;

/**
 * Pure decision: compact as soon as the row does not fit; back to wide only when it fits with
 * `hysteresis` px to spare.
 */
export function decideHeaderLayout(
  required: number,
  available: number,
  current: HeaderLayout | undefined,
  hysteresis = HEADER_HYSTERESIS_PX,
): HeaderLayout {
  if (required > available) return 'compact';
  if (current === 'compact' && required > available - hysteresis) {
    return 'compact';
  }
  return 'wide';
}

/**
 * Width the header needs for one row. Switches the header to `data-layout="measure"` (CSS:
 * `width: max-content`, nothing wraps, the panel laid out as a row even when collapsed), reads
 * the width and restores the attribute in the same task, so the measuring layout is never
 * painted.
 */
export function measureHeader(header: HTMLElement): {
  required: number;
  available: number;
} {
  const available = header.getBoundingClientRect().width;
  const previous = header.getAttribute('data-layout');
  header.setAttribute('data-layout', 'measure');
  const required = Math.ceil(header.getBoundingClientRect().width);
  if (previous === null) header.removeAttribute('data-layout');
  else header.setAttribute('data-layout', previous);
  return { required, available: Math.floor(available) };
}

type Refs = {
  header: RefObject<HTMLElement | null>;
  /** Zero-height element spanning the header: its width is the available width only. */
  sizer: RefObject<HTMLElement | null>;
  panel: RefObject<HTMLElement | null>;
  button: RefObject<HTMLButtonElement | null>;
};

/**
 * Collapses the header when its contents do not fit in one row (not at a fixed breakpoint).
 *
 * - measured before the first paint (`useLayoutEffect`) and again whenever the available width
 *   changes (ResizeObserver on a zero-height sizer, so our own height changes never re-trigger
 *   it), the header's content changes (MutationObserver: sign-in, nav items) or web fonts load;
 * - updates are committed synchronously (`flushSync`) inside the observer callbacks, so the
 *   wrong layout is never painted;
 * - an open compact panel is not re-measured (its contents are laid out as a column); it is
 *   measured again when it closes;
 * - without ResizeObserver (old browsers, jsdom) it stays `undefined` and the CSS breakpoint
 *   applies.
 */
export function useHeaderLayout(
  refs: Refs,
  open: boolean,
  onLayoutChange: (layout: HeaderLayout) => void,
): HeaderLayout | undefined {
  const [layout, setLayout] = useState<HeaderLayout>();
  const layoutRef = useRef<HeaderLayout | undefined>(undefined);
  const openRef = useRef(open);
  const onChangeRef = useRef(onLayoutChange);
  const refsRef = useRef(refs);

  useLayoutEffect(() => {
    openRef.current = open;
    onChangeRef.current = onLayoutChange;
    refsRef.current = refs;
  });

  const update = useCallback((sync: boolean) => {
    const { header, panel, button } = refsRef.current;
    const element = header.current;
    if (!element) return;
    if (openRef.current && layoutRef.current === 'compact') return;
    const { required, available } = measureHeader(element);
    const next = decideHeaderLayout(required, available, layoutRef.current);
    if (next === layoutRef.current) return;
    const focusInPanel =
      next === 'compact' &&
      panel.current !== null &&
      panel.current.contains(document.activeElement);
    layoutRef.current = next;
    const apply = () => {
      setLayout(next);
      onChangeRef.current(next);
    };
    if (sync) flushSync(apply);
    else apply();
    // the panel is about to be hidden: keep focus on the control that reveals it
    if (focusInPanel) button.current?.focus();
  }, []);

  useLayoutEffect(() => {
    const header = refsRef.current.header.current;
    const sizer = refsRef.current.sizer.current;
    if (!header || typeof ResizeObserver === 'undefined') return undefined;
    update(false);
    let active = true;
    const resize = new ResizeObserver(() => {
      if (active) update(true);
    });
    if (sizer) resize.observe(sizer);
    const mutation = new MutationObserver(() => {
      if (active) update(true);
    });
    mutation.observe(header, {
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
