import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router';
import { ThemeProvider } from '../../providers/ThemeProvider';
import { MainLayout } from './MainLayout';
import type { NavPlacement } from './navPlacement';
import { useNavPlacement } from './navPlacement';
import { HEADER_HYSTERESIS_PX, decideHeaderLayout } from './useHeaderLayout';

function renderLayout(navPlacement?: NavPlacement) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            element={
              <MainLayout
                brand="Portal"
                navPlacement={navPlacement}
                nav={
                  <ul aria-label="Apps">
                    <li>
                      <Link to="/">Home</Link>
                    </li>
                    <li>
                      <Link to="/a">Alpha</Link>
                    </li>
                  </ul>
                }
                headerActions={<button type="button">Sign in</button>}
              />
            }
          >
            <Route index element={<p>home page</p>} />
            <Route path="a" element={<p>alpha page</p>} />
          </Route>
        </Routes>
        <p>outside</p>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('MainLayout', () => {
  it('renders brand, theme toggle and the routed page via <Outlet />', () => {
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route element={<MainLayout brand="Portal" />}>
              <Route index element={<p>home page</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );
    expect(screen.getByText('Portal')).toBeInTheDocument();
    expect(screen.getByLabelText('Use dark theme')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('home page');
    expect(screen.queryByTestId('connection-required')).not.toBeInTheDocument();
  });

  it('shows the connection banner when offline', () => {
    render(
      <ThemeProvider>
        <MainLayout online={false}>
          <p>content</p>
        </MainLayout>
      </ThemeProvider>,
    );
    expect(screen.getByTestId('connection-required')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('content');
  });

  it('has a Menu disclosure controlling the panel with nav, theme toggle and actions', async () => {
    const user = userEvent.setup();
    renderLayout();
    const button = screen.getByRole('button', { name: 'Menu' });
    const panel = screen.getByTestId('header-panel');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('aria-controls', panel.id);
    expect(panel).toContainElement(
      screen.getByRole('navigation', { name: 'Main' }),
    );
    expect(panel).toContainElement(screen.getByLabelText('Use dark theme'));
    expect(panel).toContainElement(
      screen.getByRole('button', { name: 'Sign in' }),
    );
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(panel.className).toMatch(/open/);
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on Escape and returns focus to the button', async () => {
    const user = userEvent.setup();
    renderLayout();
    const button = screen.getByRole('button', { name: 'Menu' });
    await user.click(button);
    await user.tab(); // into the panel
    expect(screen.getByTestId('header-panel')).toContainElement(
      document.activeElement as HTMLElement,
    );
    await user.keyboard('{Escape}');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
  });

  it('closes after following a link inside, focus back on the button', async () => {
    const user = userEvent.setup();
    renderLayout();
    const button = screen.getByRole('button', { name: 'Menu' });
    await user.click(button);
    await user.click(screen.getByRole('link', { name: 'Alpha' }));
    expect(screen.getByRole('main')).toHaveTextContent('alpha page');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
  });

  it('closes on a click outside the header, but not inside it', async () => {
    const user = userEvent.setup();
    renderLayout();
    const button = screen.getByRole('button', { name: 'Menu' });
    await user.click(button);
    await user.click(screen.getByLabelText('Use dark theme'));
    expect(button).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByText('outside'));
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).not.toHaveFocus();
  });

  it('labels the menu button and nav landmark when asked', () => {
    render(
      <ThemeProvider>
        <MainLayout nav={<a href="/x">X</a>} navLabel="Apps" menuLabel="Browse">
          <p>content</p>
        </MainLayout>
      </ThemeProvider>,
    );
    expect(screen.getByRole('button', { name: 'Browse' })).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Apps' }),
    ).toBeInTheDocument();
  });
});

const LONG_BRAND = 'Citizen Services Portal of the Example Region';

/** One top-level rule of MainLayout.module.scss, nested rules included. */
function scssRule(selector: string): string {
  const source = readFileSync(
    join(__dirname, 'MainLayout.module.scss'),
    'utf8',
  );
  const start = source.indexOf(`\n${selector} {`);
  expect(start).toBeGreaterThanOrEqual(0);
  return source.slice(start, source.indexOf('\n}', start));
}

describe('MainLayout: header colours (--header-* tokens)', () => {
  it('reads every header token with a fallback to the page tokens (unset = unchanged look)', () => {
    // whitespace-insensitive (Prettier may wrap long var() chains)
    const host = scssRule('.host')
      .replace(/\s+/g, ' ')
      .replace(/\( /g, '(')
      .replace(/ \)/g, ')');
    for (const declaration of [
      '--_header-bg: var(--header-bg, var(--color-surface));',
      '--_header-text: var(--header-text, var(--color-text));',
      '--_header-text-muted: var(--header-text-muted, var(--header-text, var(--color-text-muted)));',
      '--_header-border: var(--header-border, var(--color-border));',
      '--_header-accent: var(--header-accent, var(--header-text, var(--color-accent)));',
      // text on the pressed (accent) theme button
      '--_header-on-accent: var(--header-bg, var(--color-accent-contrast));',
      // only valid once --header-bg is set; otherwise the page --color-bg is kept for hovers
      '--_header-hover: color-mix(in srgb, var(--_header-text) 14%, var(--header-bg));',
      '--_page-bg: var(--color-bg);',
    ]) {
      expect(host).toContain(declaration);
    }
  });

  it('maps them onto the page token names inside the header, so header content follows', () => {
    const header = scssRule('.header');
    for (const [token, resolved] of [
      ['--color-surface', '--_header-bg'],
      ['--color-text', '--_header-text'],
      ['--color-text-muted', '--_header-text-muted'],
      ['--color-border', '--_header-border'],
      ['--color-accent', '--_header-accent'],
      ['--color-accent-contrast', '--_header-on-accent'],
    ]) {
      expect(header).toContain(`${token}: var(${resolved});`);
    }
    expect(header).toContain(
      '--color-bg: var(--_header-hover, var(--_page-bg));',
    );
    expect(header).toMatch(/color: var\(--color-text\);/);
    expect(header).toMatch(/background: var\(--color-surface\);/);
    expect(header).toMatch(/border-bottom: 1px solid var\(--color-border\);/);
  });

  it('never hardcodes a colour (everything in the header goes through the tokens)', () => {
    const source = readFileSync(
      join(__dirname, 'MainLayout.module.scss'),
      'utf8',
    ).replace(/\/\*[\s\S]*?\*\//g, '');
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    // the only rgb() is the panel's drop shadow
    expect(source.match(/rgb\(/g)).toHaveLength(1);
  });
});

describe('MainLayout: long brand names', () => {
  it('truncates on screen only: one line, ellipsis, shrinks before anything else', () => {
    const brand = scssRule('.brand');
    expect(brand).toMatch(/white-space: nowrap;/);
    expect(brand).toMatch(/overflow: hidden;/);
    expect(brand).toMatch(/text-overflow: ellipsis;/);
    expect(brand).toMatch(/min-width: 0;/);
    expect(brand).toMatch(/flex: 0 1 auto;/);
    expect(brand).not.toMatch(/overflow-wrap/);
    // the measurement caps the brand, so a long name cannot force compact at every width
    expect(scssRule(".header[data-layout='measure']")).toMatch(
      /max-width: var\(--header-brand-min-width, 30ch\);/,
    );
  });

  it('keeps the full text in the DOM and the accessibility tree, once, without a tooltip', () => {
    render(
      <ThemeProvider>
        <MainLayout brand={LONG_BRAND}>
          <p>content</p>
        </MainLayout>
      </ThemeProvider>,
    );
    const brand = screen.getByTestId('header-brand');
    expect(brand).toHaveClass('brand');
    expect(brand).toHaveTextContent(LONG_BRAND, { normalizeWhitespace: true });
    expect(brand).not.toHaveAttribute('title');
    expect(brand).not.toHaveAttribute('aria-label');
    // no visually hidden duplicate: the banner holds the name exactly once
    const banner = screen.getByRole('banner');
    expect(banner.textContent?.split(LONG_BRAND)).toHaveLength(2);
    expect(screen.getAllByText(LONG_BRAND)).toHaveLength(1);
  });

  it('a brand link keeps the full accessible name', () => {
    render(
      <ThemeProvider>
        <MemoryRouter>
          <MainLayout brand={<Link to="/">{LONG_BRAND}</Link>}>
            <p>content</p>
          </MainLayout>
        </MemoryRouter>
      </ThemeProvider>,
    );
    const link = screen.getByRole('link', { name: LONG_BRAND });
    expect(screen.getByTestId('header-brand')).toContainElement(link);
    expect(link).not.toHaveAttribute('title');
    expect(link).toHaveAccessibleName(LONG_BRAND);
    expect(link).not.toHaveAccessibleDescription();
  });
});

describe('MainLayout: one header row at any width (measured layout)', () => {
  type Observer = { callback: () => void; targets: Element[] };
  const observers: Observer[] = [];
  /** Widths the fake layout reports: the header's own width and its unwrapped row width. */
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

  const header = () => screen.getByTestId('main-header');

  it('without ResizeObserver leaves the layout to the CSS breakpoint', () => {
    delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
    renderLayout();
    expect(header()).not.toHaveAttribute('data-layout');
  });

  it('is wide when brand, nav and actions fit in one row (measured before paint)', () => {
    renderLayout();
    expect(header()).toHaveAttribute('data-layout', 'wide');
    // the measuring layout never stays on the element
    expect(header().getAttribute('data-layout')).not.toBe('measure');
  });

  it('collapses behind Menu when the row does not fit, at any width', () => {
    size.required = 1400; // e.g. many remotes + signed-in user at 1280 px
    renderLayout();
    expect(header()).toHaveAttribute('data-layout', 'compact');
  });

  it('follows the available width, with hysteresis before expanding again', () => {
    size.required = 1000;
    renderLayout();
    expect(header()).toHaveAttribute('data-layout', 'wide');
    resizeTo(990);
    expect(header()).toHaveAttribute('data-layout', 'compact');
    // fits, but by less than the hysteresis margin: stays compact (no flip-flop)
    resizeTo(1000 + HEADER_HYSTERESIS_PX - 1);
    expect(header()).toHaveAttribute('data-layout', 'compact');
    resizeTo(1000 + HEADER_HYSTERESIS_PX);
    expect(header()).toHaveAttribute('data-layout', 'wide');
  });

  it('re-measures when the header content changes (e.g. a user signs in)', async () => {
    const { rerender } = render(
      <ThemeProvider>
        <MainLayout brand="Portal" headerActions={<span>Sign in</span>}>
          <p>content</p>
        </MainLayout>
      </ThemeProvider>,
    );
    expect(header()).toHaveAttribute('data-layout', 'wide');
    size.required = 1500;
    rerender(
      <ThemeProvider>
        <MainLayout
          brand="Portal"
          headerActions={<span>A very long user name, Sign out</span>}
        >
          <p>content</p>
        </MainLayout>
      </ThemeProvider>,
    );
    await waitFor(() =>
      expect(header()).toHaveAttribute('data-layout', 'compact'),
    );
  });

  it('closes an open panel when the header becomes wide', async () => {
    const user = userEvent.setup();
    size.required = 1400;
    renderLayout();
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

  it('moves focus to the Menu button when the focused nav collapses', async () => {
    const user = userEvent.setup();
    renderLayout();
    await user.click(screen.getByRole('link', { name: 'Alpha' }));
    screen.getByRole('link', { name: 'Alpha' }).focus();
    size.required = 1400;
    resizeTo(1280);
    expect(header()).toHaveAttribute('data-layout', 'compact');
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveFocus();
  });
});

describe('MainLayout: navPlacement="side" (measured)', () => {
  const size = { available: 1280, required: 900 };
  let rectSpy: jest.SpyInstance;

  class FakeResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  beforeEach(() => {
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
        return { width, height: 60, toJSON: () => ({}) } as DOMRect;
      });
  });

  afterEach(() => {
    rectSpy.mockRestore();
    delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
  });

  /** Names of the focusable header elements in DOM (= Tab) order. */
  function tabOrder() {
    return [
      ...screen.getByTestId('header-panel').querySelectorAll('a, button'),
    ].map((el) => el.textContent);
  }

  it('wide: top bar (theme toggle, actions) comes before the sidebar nav in the Tab order', () => {
    size.required = 900; // = sidebar + minimum content width, counted by the CSS
    renderLayout('side');
    expect(screen.getByTestId('main-header')).toHaveAttribute(
      'data-layout',
      'wide',
    );
    const order = tabOrder();
    expect(order.indexOf('Sign in')).toBeLessThan(order.indexOf('Home'));
  });

  it('compact: the drawer lists the nav first, then theme toggle and actions', () => {
    size.available = 800;
    renderLayout('side');
    expect(screen.getByTestId('main-header')).toHaveAttribute(
      'data-layout',
      'compact',
    );
    const order = tabOrder();
    expect(order.indexOf('Home')).toBeLessThan(order.indexOf('Sign in'));
  });

  it('top placement keeps the nav first at every width', () => {
    renderLayout('top');
    expect(screen.getByTestId('main-header')).toHaveAttribute(
      'data-layout',
      'wide',
    );
    const order = tabOrder();
    expect(order.indexOf('Home')).toBeLessThan(order.indexOf('Sign in'));
  });
});

describe('MainLayout: navPlacement', () => {
  function Probe() {
    return <span data-testid="probe">{useNavPlacement()}</span>;
  }

  it('defaults to top and exposes the placement on the header', () => {
    renderLayout();
    expect(screen.getByTestId('main-header')).toHaveAttribute(
      'data-nav-placement',
      'top',
    );
    renderLayout('side');
    expect(screen.getAllByTestId('main-header')[1]).toHaveAttribute(
      'data-nav-placement',
      'side',
    );
  });

  it.each(['top', 'side'] as const)(
    'provides the placement to nav content and header actions (%s)',
    (placement) => {
      render(
        <ThemeProvider>
          <MainLayout navPlacement={placement} nav={<Probe />}>
            <p>content</p>
          </MainLayout>
        </ThemeProvider>,
      );
      expect(screen.getByTestId('probe')).toHaveTextContent(placement);
    },
  );

  it('useNavPlacement is top outside MainLayout (and in the page content)', () => {
    render(
      <ThemeProvider>
        <MainLayout navPlacement="side">
          <Probe />
        </MainLayout>
      </ThemeProvider>,
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('top');
  });

  it.each(['top', 'side'] as const)(
    'landmarks (%s): one banner holding the named nav, one main',
    (placement) => {
      renderLayout(placement);
      const banner = screen.getByRole('banner');
      expect(screen.getAllByRole('banner')).toHaveLength(1);
      expect(screen.getAllByRole('main')).toHaveLength(1);
      const nav = screen.getByRole('navigation', { name: 'Main' });
      expect(banner).toContainElement(nav);
      expect(screen.getAllByRole('navigation')).toHaveLength(1);
      expect(screen.getByRole('main')).not.toContainElement(nav);
    },
  );

  it.each(['top', 'side'] as const)(
    'skip link (%s): first Tab stop, moves focus to main without a URL change',
    async (placement) => {
      const user = userEvent.setup();
      renderLayout(placement);
      await user.tab();
      const skip = screen.getByRole('link', { name: 'Skip to main content' });
      expect(skip).toHaveFocus();
      const main = screen.getByRole('main');
      expect(skip).toHaveAttribute('href', `#${main.id}`);
      expect(main).toHaveAttribute('tabindex', '-1');
      await user.keyboard('{Enter}');
      expect(main).toHaveFocus();
      expect(main).toHaveTextContent('home page'); // still on the same route
    },
  );

  it('skipLinkLabel renames the skip link', () => {
    render(
      <ThemeProvider>
        <MainLayout skipLinkLabel="Zum Inhalt">
          <p>content</p>
        </MainLayout>
      </ThemeProvider>,
    );
    expect(
      screen.getByRole('link', { name: 'Zum Inhalt' }),
    ).toBeInTheDocument();
  });

  describe('side drawer (narrow screens): the same disclosure as the top panel', () => {
    it('Menu button controls the drawer with nav, theme toggle and actions', async () => {
      const user = userEvent.setup();
      renderLayout('side');
      const button = screen.getByRole('button', { name: 'Menu' });
      const panel = screen.getByTestId('header-panel');
      expect(button).toHaveAttribute('aria-controls', panel.id);
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(panel).toContainElement(
        screen.getByRole('navigation', { name: 'Main' }),
      );
      expect(panel).toContainElement(screen.getByLabelText('Use dark theme'));
      expect(panel).toContainElement(
        screen.getByRole('button', { name: 'Sign in' }),
      );
      await user.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'true');
      expect(panel.className).toMatch(/open/);
    });

    it('Escape closes and returns focus to the Menu button', async () => {
      const user = userEvent.setup();
      renderLayout('side');
      const button = screen.getByRole('button', { name: 'Menu' });
      await user.click(button);
      await user.tab();
      expect(screen.getByTestId('header-panel')).toContainElement(
        document.activeElement as HTMLElement,
      );
      await user.keyboard('{Escape}');
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).toHaveFocus();
    });

    it('closes after following a link, on an outside click and on back/forward', async () => {
      const user = userEvent.setup();
      renderLayout('side');
      const button = screen.getByRole('button', { name: 'Menu' });
      await user.click(button);
      await user.click(screen.getByRole('link', { name: 'Alpha' }));
      expect(screen.getByRole('main')).toHaveTextContent('alpha page');
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).toHaveFocus();
      await user.click(button);
      await user.click(screen.getByText('outside'));
      expect(button).toHaveAttribute('aria-expanded', 'false');
      await user.click(button);
      act(() => {
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });
  });

  it('side styles: 16rem sidebar, 40rem minimum content, drawer at most 20rem', () => {
    const source = readFileSync(
      join(__dirname, 'MainLayout.module.scss'),
      'utf8',
    );
    expect(source).toMatch(/^\$sidebar-width: 16rem;$/m);
    expect(source).toMatch(/^\$side-main-min-width: 40rem;$/m);
    expect(source).toMatch(/^\$side-drawer-width: 20rem;$/m);
    // the measurement counts the sidebar plus the minimum content width, without the nav
    const measure = scssRule(".side[data-layout='measure']");
    expect(measure).toMatch(
      /min-width: \$sidebar-width \+ \$side-main-min-width;/,
    );
    expect(measure).toMatch(/\.nav \{\s*display: none;/);
    // sticky top bar; the sidebar uses the (remapped) header tokens
    expect(scssRule('.side')).toMatch(/position: sticky;/);
    expect(source).toMatch(
      /background: var\(--color-surface\);\n\s*border-right: 1px solid var\(--color-border\);/,
    );
  });
});

describe('decideHeaderLayout', () => {
  it('compact when the row is wider than the space', () => {
    expect(decideHeaderLayout(1001, 1000, undefined)).toBe('compact');
    expect(decideHeaderLayout(1001, 1000, 'wide')).toBe('compact');
  });

  it('wide when it fits; from compact only with the hysteresis margin', () => {
    expect(decideHeaderLayout(1000, 1000, undefined)).toBe('wide');
    expect(decideHeaderLayout(1000, 1000, 'wide')).toBe('wide');
    expect(decideHeaderLayout(1000, 1010, 'compact', 24)).toBe('compact');
    expect(decideHeaderLayout(1000, 1024, 'compact', 24)).toBe('wide');
  });
});
