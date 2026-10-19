import { useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useMenuDisclosure } from '../useMenuDisclosure';
import {
  FIT_HYSTERESIS_PX,
  decideFitLayout,
  measureFit,
  useFitLayout,
} from './useFitLayout';
import type { FitLayout } from './useFitLayout';

/** A collapsing header built from the hook + useMenuDisclosure, like a shell layout. */
function Header({
  actions = <button type="button">Sign in</button>,
}: {
  actions?: ReactNode;
}) {
  const menu = useMenuDisclosure();
  const sizer = useRef<HTMLDivElement>(null);
  const { setOpen } = menu;
  const onChange = useCallback(
    (next: FitLayout) => {
      if (next === 'wide') setOpen(false);
    },
    [setOpen],
  );
  const layout = useFitLayout({
    container: menu.containerRef,
    sizer,
    panel: menu.panelRef,
    button: menu.buttonRef,
    open: menu.open,
    onChange,
  });
  return (
    <header ref={menu.containerRef} data-testid="header" data-layout={layout}>
      <div ref={sizer} />
      <span>Portal</span>
      <button {...menu.buttonProps}>Menu</button>
      <div {...menu.panelProps}>
        <nav aria-label="Main">
          <a href="/a">Alpha</a>
        </nav>
        {actions}
      </div>
    </header>
  );
}

describe('useFitLayout', () => {
  type Observer = { callback: () => void; targets: Element[] };
  const observers: Observer[] = [];
  /** Widths the fake layout reports: the container's own width and its unwrapped row width. */
  const size = { available: 1280, required: 900 };
  let rectSpy: jest.SpyInstance;

  class FakeResizeObserver {
    private readonly entry: Observer;
    constructor(callback: () => void) {
      this.entry = { callback, targets: [] };
      observers.push(this.entry);
    }
    observe(target: Element) {
      this.entry.targets.push(target);
    }
    unobserve() {}
    disconnect() {
      this.entry.targets = [];
    }
  }

  /** The viewport (available width) changed: notify like the browser would. */
  function resizeTo(available: number) {
    size.available = available;
    act(() => {
      for (const o of observers) if (o.targets.length > 0) o.callback();
    });
  }

  beforeEach(() => {
    observers.length = 0;
    size.available = 1280;
    size.required = 900;
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver =
      FakeResizeObserver;
    rectSpy = jest
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        const width =
          this.getAttribute('data-layout') === 'measure'
            ? size.required
            : size.available;
        return {
          width,
          height: 60,
          top: 0,
          left: 0,
          right: width,
          bottom: 60,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        } as DOMRect;
      });
  });

  afterEach(() => {
    rectSpy.mockRestore();
    delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
  });

  const header = () => screen.getByTestId('header');

  it('without ResizeObserver leaves the layout to the CSS breakpoint', () => {
    delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
    render(<Header />);
    expect(header()).not.toHaveAttribute('data-layout');
  });

  it('is wide when the row fits (measured before paint)', () => {
    render(<Header />);
    expect(header()).toHaveAttribute('data-layout', 'wide');
    // the measuring layout never stays on the element
    expect(header().getAttribute('data-layout')).not.toBe('measure');
  });

  it('is compact when the row does not fit, at any width', () => {
    size.required = 1400; // e.g. many remotes + signed-in user at 1280 px
    render(<Header />);
    expect(header()).toHaveAttribute('data-layout', 'compact');
  });

  it('follows the available width, with hysteresis before expanding again', () => {
    size.required = 1000;
    render(<Header />);
    expect(header()).toHaveAttribute('data-layout', 'wide');
    resizeTo(990);
    expect(header()).toHaveAttribute('data-layout', 'compact');
    // fits, but by less than the hysteresis margin: stays compact (no flip-flop)
    resizeTo(1000 + FIT_HYSTERESIS_PX - 1);
    expect(header()).toHaveAttribute('data-layout', 'compact');
    resizeTo(1000 + FIT_HYSTERESIS_PX);
    expect(header()).toHaveAttribute('data-layout', 'wide');
  });

  it('re-measures when the content changes (e.g. a user signs in)', async () => {
    const { rerender } = render(<Header actions={<span>Sign in</span>} />);
    expect(header()).toHaveAttribute('data-layout', 'wide');
    size.required = 1500;
    rerender(<Header actions={<span>A very long user name, Sign out</span>} />);
    await waitFor(() =>
      expect(header()).toHaveAttribute('data-layout', 'compact'),
    );
  });

  it('does not re-measure an open panel; closes it when the layout becomes wide', async () => {
    const user = userEvent.setup();
    size.required = 1400;
    render(<Header />);
    const button = screen.getByRole('button', { name: 'Menu' });
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    // an open panel is not re-laid out while open...
    resizeTo(1300);
    expect(header()).toHaveAttribute('data-layout', 'compact');
    // ...but once there is room it is measured again after closing
    size.required = 900;
    resizeTo(1280);
    await user.keyboard('{Escape}');
    expect(header()).toHaveAttribute('data-layout', 'wide');
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('moves focus to the Menu button when the focused panel collapses', () => {
    render(<Header />);
    screen.getByRole('link', { name: 'Alpha' }).focus();
    size.required = 1400;
    resizeTo(1280);
    expect(header()).toHaveAttribute('data-layout', 'compact');
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveFocus();
  });

  it('calls onChange for every change', () => {
    const onChange = jest.fn();
    function Probe() {
      const container = useRef<HTMLDivElement>(null);
      const sizer = useRef<HTMLDivElement>(null);
      const panel = useRef<HTMLDivElement>(null);
      const button = useRef<HTMLButtonElement>(null);
      useFitLayout({ container, sizer, panel, button, open: false, onChange });
      return (
        <div ref={container}>
          <div ref={sizer} />
          <button ref={button} type="button">
            Menu
          </button>
          <div ref={panel} />
        </div>
      );
    }
    render(<Probe />);
    expect(onChange).toHaveBeenLastCalledWith('wide');
    size.required = 2000;
    resizeTo(1280);
    expect(onChange).toHaveBeenLastCalledWith('compact');
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});

describe('measureFit', () => {
  it('reads the row width in the measuring layout and restores the attribute', () => {
    const element = document.createElement('header');
    element.setAttribute('data-layout', 'compact');
    const seen: (string | null)[] = [];
    jest.spyOn(element, 'getBoundingClientRect').mockImplementation(() => {
      seen.push(element.getAttribute('data-layout'));
      return {
        width:
          element.getAttribute('data-layout') === 'measure' ? 900.2 : 640.8,
      } as DOMRect;
    });
    expect(measureFit(element)).toEqual({ required: 901, available: 640 });
    expect(seen).toEqual(['compact', 'measure']);
    expect(element).toHaveAttribute('data-layout', 'compact');
    element.removeAttribute('data-layout');
    measureFit(element);
    expect(element).not.toHaveAttribute('data-layout');
  });
});

describe('decideFitLayout', () => {
  it('compact when the row is wider than the space', () => {
    expect(decideFitLayout(1001, 1000, undefined)).toBe('compact');
    expect(decideFitLayout(1001, 1000, 'wide')).toBe('compact');
  });

  it('wide when it fits; from compact only with the hysteresis margin', () => {
    expect(decideFitLayout(1000, 1000, undefined)).toBe('wide');
    expect(decideFitLayout(1000, 1000, 'wide')).toBe('wide');
    expect(decideFitLayout(1000, 1010, 'compact', 24)).toBe('compact');
    expect(decideFitLayout(1000, 1024, 'compact', 24)).toBe('wide');
  });
});
