# @org/ui

The in-house **component library** (native HTML first, design tokens only, WCAG 2.2 AA) and
the **shell building blocks**. Use these before writing a component in an app
(docs/coding-conventions.md "Use @org/ui first"). There is no shared page layout: **each shell
owns its layout** (`src/layouts/ShellLayout`, copied from a starter by
`pnpm gen:shell <zone> [--layout top|side]`) and each remote its standalone chrome. See
`docs/ui-context.md` "Layout: the shell owns it".

No external UI or headless libraries: everything is built here on native elements
(`<button>`, `<input>`, `<select>`, `<dialog>`, `<table>`, `<fieldset>`), which bring keyboard
and screen-reader behaviour for free. The APIs follow common conventions (`variant`, `size`,
`label`, `hint`, `error`, native props passed through) so a headless library could replace the
internals later without changing call sites.

## Components

Every component takes the props of the element it renders (`type`, `name`, `onChange`,
`aria-*`, `data-testid`, …), a `ref` (React 19 ref-as-prop; it points at the native element)
and a `className` (added after its own classes; for field components it goes on the wrapper
and `inputClassName` / `selectClassName` / `textAreaClassName` style the control).

| Export           | Element                               | Notes                                                                                                                                                                                                                                  |
| ---------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`         | `<button>`                            | `variant` primary / secondary / danger / ghost, `size` sm / md / lg, `loading` (spinner + `aria-disabled`, keeps focus); `type="button"` by default                                                                                    |
| `Link`           | react-router `<Link>` or `<a>`        | `to` (in-app, needs a router) or `href` (plain); `newTab` adds `target`/`rel` and "(opens in a new tab)" for screen readers                                                                                                            |
| `TextField`      | `<input>`                             | `label`, `hint`, `error`, `required`; `type` text / email / password / search / tel / url / number                                                                                                                                     |
| `TextArea`       | `<textarea>`                          | as TextField; 4 rows by default, resizes vertically                                                                                                                                                                                    |
| `Select`         | native `<select>`                     | `options` (`{ value, label, disabled? }`) or `<option>` children, `placeholder` (empty first option)                                                                                                                                   |
| `DateField`      | `<input type="date">`                 | the browser's date picker and keyboard entry; ISO values, `min` / `max`                                                                                                                                                                |
| `Checkbox`       | `<input type="checkbox">`             | `label` to the right, `hint`, `error`; several related ones go in a `<fieldset>` + `<legend>`                                                                                                                                          |
| `RadioGroup`     | `<fieldset>` + `<legend>` + radios    | `label` (legend), `options` (`{ value, label, hint?, disabled? }`), `value` / `defaultValue` + `onChange(value)`, `hint`, `error`, `required`, `inline`                                                                                |
| `Field`          | label + hint + error                  | wiring for a custom control: `children` is `(control) => <input {...control} />` (`id`, `aria-describedby`, `aria-invalid`, `required`)                                                                                                |
| `Dialog`         | native `<dialog>` (`showModal()`)     | `open` + `onClose`, `title` (`aria-labelledby`), `description` (`aria-describedby`), `footer`, `size`; Escape closes, focus is trapped and returns to the opener; no inline styles                                                     |
| `Alert`          | `<div>`                               | `variant` info / success / warning / error, `title` (+ `headingLevel` for an error summary); `role="alert"` for error/warning, `role="status"` for info/success (`live={false}` for a message that is part of the page from the start) |
| `Card`           | `<div>` (`as` section / article / li) | surface with border; optional `title` (+ `headingLevel`) and `footer`                                                                                                                                                                  |
| `Badge`          | `<span>`                              | `variant` neutral / accent / info / success / warning / danger; the text says the state (colour is never the only signal)                                                                                                              |
| `Spinner`        | `<span role="status">`                | `label` (default `Loading…`, read by screen readers; `labelVisible` shows it), `size`; `decorative` inside a busy control; no spinning with `prefers-reduced-motion`                                                                   |
| `Table`          | `<table>`                             | `caption` (required; `captionHidden`), `columns` (`key`, `header`, `cell`, `sortable`, `sortValue`, `align`, `rowHeader`), `rows`, `getRowKey`; sort buttons with `aria-sort`, scrolls in a region                                     |
| `Tabs`           | `tablist` / `tab` / `tabpanel`        | WAI-ARIA tabs by hand: roving tabindex, Left/Right/Home/End; `activation` automatic (default) or manual (arrows only move focus: use it when showing a panel is slow)                                                                  |
| `VisuallyHidden` | `<span>`                              | text for screen readers only                                                                                                                                                                                                           |

Shell building blocks:

| Export                        | Notes                                                                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `ThemeToggle`                 | Light / Dark / Use system theme (needs a `ThemeProvider` above)                                                             |
| `SkipLink`                    | "Skip to main content": first Tab stop, visible on focus, focuses the target without a URL change (`targetId`, `children`)  |
| `Brand`                       | the app name in a header: one line, ellipsis on screen, full accessible name (any `<div>` props, `className`)               |
| `useMenuDisclosure()`         | headless Menu button + panel/drawer: state, `buttonProps`, `panelProps`, Escape / outside click / link / back-forward close |
| `useFitLayout(options)`       | measures whether a row (header) fits: `'wide' \| 'compact'`, so a layout collapses behind "Menu" exactly when needed        |
| `RemoteFallback`              | `role="alert"` panel; optional `onRetry` adds a "Try again" button                                                          |
| `ConnectionRequired`          | Offline banner (`visible`; a shell passes `!useOnlineStatus()` from `@org/pwa`)                                             |
| `ThemeProvider`, `useTheme()` | Light/dark/system theme, sets `data-theme` on `<html>`                                                                      |

```tsx
import { Alert, Button, Select, TextField } from '@org/ui';

<form noValidate onSubmit={onSubmit}>
  {formError ? <Alert variant="error">{formError}</Alert> : null}
  <TextField label="Name" name="name" required error={errors.name} />
  <Select
    label="Type"
    name="type"
    placeholder="Choose a type"
    options={types}
  />
  <Button type="submit" loading={sending}>
    {sending ? 'Sending…' : 'Send'}
  </Button>
</form>;
```

## Storybook (dev only)

| Command                | What                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| `pnpm storybook`       | Storybook dev server on http://localhost:3192 (root `package.json` `mfe.tools.storybook`)                 |
| `pnpm build-storybook` | static build in `packages/ui/storybook-static/` (git-ignored, Nx cached)                                  |
| `pnpm test:ui`         | builds Storybook, then axe (WCAG 2.2 AA) + screenshots of every story in light and dark (port 3193)       |
| `pnpm test:ui:update`  | the same, writing new screenshot baselines (`visual/__screenshots__/<platform>/`); review and commit them |

Storybook 10 with the webpack 5 builder (`.storybook/main.ts`: the apps' swc + Sass + CSS
Modules loaders) is a devDependency of this package only: no app depends on it and nothing in
`src/` imports it, so it never reaches an app bundle. The toolbar's **Theme** switch sets
`data-theme` on `<html>` (the global decorator in `.storybook/preview.tsx`, which also loads
`@org/design-tokens/global.scss`).

`pnpm test:ui` (Playwright, `visual/`) opens each story of the static build in both themes:
axe with the tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` must report nothing,
and the page must match its baseline screenshot. Baselines depend on the OS's font rendering,
so they are stored per platform; the repo has `darwin` ones. On a platform without baselines
(e.g. Linux CI) the a11y checks still run and the screenshots are skipped with a note: generate
them once on that platform (`pnpm test:ui:update`, e.g. in the CI image) and commit them. It is
not part of `pnpm test`, which stays fast.

## Adding a component

1. `src/components/<Name>/` with `<Name>.tsx`, `<Name>.module.scss`, `<Name>.test.tsx` and
   `<Name>.stories.tsx` (`pnpm check` rule `ui-component-files`). No `index.ts` in the folder:
   export it (and its props type) from `src/index.ts`.
2. Start from the native element and extend its props
   (`ComponentPropsWithRef<'button'> & { variant?: … }`); spread the rest onto the element,
   merge `className` last (`cx()` from `src/utils/cx/cx.ts`). Reuse the prop names above.
3. Styles: tokens only (`var(--color-…)`, `var(--space-…)`, no colour literals), light and dark
   come from the tokens; visible focus with the `focus-ring` mixin
   (`@use '../../styles/mixins' as *;`); no inline styles (strict CSP).
4. Tests: roles, names, keyboard and ARIA states with Testing Library. Stories: one per
   meaningful state (default, error, disabled, …); every story is run by `pnpm test:ui`.
5. `pnpm test:ui:update`, look at the new screenshots, commit them.

A component that two apps have copied is flagged by `pnpm check` (`shared-component`): move it
here. Intentional per-app copies are listed with a reason in the root `package.json`
`mfe.componentDuplicatesAllowed`.

`@org/ui` is a **tier-1 singleton**: `@org/webpack-config` shares it through Module Federation
(`singleton`, `strictVersion`, `requiredVersion` = this package's version). A remote rendered in a
shell therefore uses the shell's copy of these components, styles and the `ThemeContext`. That
is also why it holds no layout: every change here rebuilds every app, so what one shell wants
to look different (its header, its nav position) lives in that shell.

Styles are SCSS modules that read CSS variables from `@org/design-tokens` (including the status
colours `--color-success`, `--color-warning`, `--color-info` and their `-bg` pairs). The app
that owns the page imports `@org/design-tokens/global.scss` once. Their class names are CSS Modules names
with a per-app hash (`Button_button__x3Yb1`): never select them from an app; pass a `className` (the components merge
it after their own) or set tokens.

## ThemeProvider: shell, remote, standalone

Only one provider ever owns the document theme (`data-theme`, `data-theme-preference` and
`data-theme-owner` on `<html>`, plus the `localStorage` preference). With the default
`mode="auto"` a provider picks its role at mount:

| Situation                                                                                                               | Behaviour                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No provider above it, `<html>` not owned (shell, or remote standalone)                                                  | **root**: reads `localStorage`/`prefers-color-scheme`, writes `<html>`, persists toggles                                                                    |
| Inside another `ThemeProvider` (remote in a shell, `@org/ui` shared)                                                    | **pass-through**: renders children only; `useTheme()` returns the shell's context, so a toggle in the remote changes the shell theme                        |
| No provider above it but `<html>` already owned (remote with its own unshared `@org/ui` copy, e.g. a version exception) | **follower**: mirrors `<html>` via `MutationObserver`; `setTheme` dispatches `mfe:theme-request`, which the owner applies. Never writes `<html>` or storage |

So a remote can always wrap itself in `ThemeProvider` (the `@org/mf-runtime/remote` helper does
this). It looks the same as the shell because the tokens are CSS variables inherited from
`<html>`. Remotes must not import the global styles from their exposed module.

`mode="root"` or `mode="follower"` forces a role. `storageKey` changes the localStorage key
(default `mfe-theme`).

## Building a layout

The generated shell layouts show the full pattern (`tools/generators/templates/shell-layouts/`
at the repo root, `top` and `side`); in short:

```tsx
const mainId = useId();
const sizerRef = useRef<HTMLDivElement>(null);
const menu = useMenuDisclosure();
const { setOpen } = menu;
const onChange = useCallback((next: FitLayout) => next === 'wide' && setOpen(false), [setOpen]);
const layout = useFitLayout({
  container: menu.containerRef, sizer: sizerRef, panel: menu.panelRef,
  button: menu.buttonRef, open: menu.open, onChange,
});

<SkipLink targetId={mainId} />
<header ref={menu.containerRef} className={styles.header} data-layout={layout}>
  <div ref={sizerRef} className={styles.sizer} aria-hidden="true" />
  <Brand className={styles.brand}>{APP_TITLE}</Brand>
  <button {...menu.buttonProps} className={styles.menuButton}>Menu</button>
  <div {...menu.panelProps} className={menu.open ? `${styles.panel} ${styles.open}` : styles.panel}>
    <nav aria-label="Main">…</nav>
    <ThemeToggle />
    <UserMenu />
  </div>
</header>
<main id={mainId} tabIndex={-1}>…</main>
```

### `SkipLink`

`<SkipLink targetId={mainId} />` renders `<a href="#<id>">Skip to main content</a>` (text from
`children`). Visually hidden (clipped, out of the flow: no pixel of the layout changes) until it
has keyboard focus, then shown over the top-left corner with the page tokens. Activating it
focuses the target (give `<main>` `tabIndex={-1}` and no focus ring) without a `#fragment` URL
change, which would be a router navigation. Render it as the first focusable element.

### `Brand`

`<Brand className={styles.brand}>{APP_TITLE}</Brand>`: a `<div>` (all `<div>` props pass
through, e.g. `data-testid`) that keeps the name on **one line**. It owns only the truncation;
the layout owns typography and sizing through `className` (give it `flex: 0 1 auto` so it is the
item that shrinks first, so the Menu button, nav and actions always stay fully visible).

#### Long brand names

The brand is always **one line**. A name longer than the space left is truncated with an
ellipsis on screen (`white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
min-width: 0`); it is the flex item that shrinks first, so the Menu button, nav and actions
always stay fully visible.

- **Fit rule** (in the generated layouts' measuring CSS). The measurement counts the brand at
  its full width, but at most `--header-brand-min-width` (CSS custom property, default `30ch`
  of the brand font). So the header is wide when brand + nav + actions fit with the brand
  at full width (or, for a longer name, at least 30ch). Names up to that width never truncate
  in the wide layout; a longer name cannot keep the header compact at every width: in the wide
  layout it then shrinks, never below 30ch. The compact layout truncates the brand to whatever
  is left beside the Menu button (no minimum: the Menu button always wins).
- **No oscillation.** The measured width depends neither on the current layout nor on how much
  the brand is currently truncated (the measuring layout resets both), and truncation does not
  change the DOM, so it cannot re-trigger the `MutationObserver`; the 24 px hysteresis still
  applies.
- **Screen readers** get the full name: CSS clips only the painting, the DOM text (and so the
  accessible name of a brand link) stays whole. Do not add a visually hidden copy (it would be
  read twice).
- **No `title` tooltip** (decided): it would only help mouse users (truncation happens mostly on
  touch screens, and tooltips cannot be reached by keyboard), some screen readers announce a
  `title` as an extra description (the name twice), and it would need its own resize
  measurement. Instead apps must show the full name elsewhere: the generated shell has it as
  the home page `<h1>` and the document `<title>` (see `docs/ui-context.md`).
- Pass text or inline content (e.g. a home `<Link>`) as children; a single block child
  truncates too. A padding/negative-margin pair keeps a focused brand link's focus ring inside the
  clipped box.

### `useMenuDisclosure()`

The WAI-ARIA disclosure for a "Menu" button and the panel or drawer it shows; markup and styles
stay in the layout.

```ts
const menu = useMenuDisclosure<TPanel = HTMLDivElement, TContainer = HTMLElement>();
menu.open; menu.setOpen(v); menu.toggle(); menu.close(restoreFocus?);
menu.buttonProps  // { ref, type: 'button', 'aria-expanded', 'aria-controls', onClick }
menu.panelProps   // { ref, id, onClick }
menu.containerRef // optional: the element around both (e.g. <header>)
menu.buttonRef; menu.panelRef; menu.panelId;
```

- the button gets `aria-expanded` and `aria-controls` (the panel's generated `id`); render the
  panel `display: none` while closed, so it is out of the tab order and the accessibility tree;
- **Escape** closes it and returns focus to the button;
- a **pointer down outside** `containerRef` (or, without it, outside button and panel) closes it
  and leaves focus where the user put it;
- a **followed link inside the panel** (a click on `a[href]`, also Enter on a link) and
  **browser back/forward** (`popstate`) close it;
- closing while focus is inside the panel moves focus to the button (never lost on `<body>`);
- listeners are attached only while it is open.

### `useFitLayout(options)`

Collapses a header when its contents do not fit in one row, at any width (many remotes, a long
user name, signed in or out), instead of at a fixed breakpoint.

```ts
const layout: 'wide' | 'compact' | undefined = useFitLayout({
  container, // the row, e.g. <header>; put `data-layout={layout}` on it
  sizer, // zero-height strip across it (absolute, left 0, right 0): the available width
  panel, // the collapsible panel; button: the Menu button
  button,
  open, // menu.open
  onChange, // e.g. close the panel when it becomes wide
});
```

- **Measures**: sets `data-layout="measure"` on the container, reads its width, restores the
  attribute in the same task (never painted). The layout's CSS defines what "one row" means
  there (`width: max-content`, nothing wraps, the panel laid out as a row even when closed, the
  Menu button hidden, the brand capped at `--header-brand-min-width`; a sidebar layout leaves
  the nav out and adds a minimum content width). Compared with the container's width.
- When: before the first paint (`useLayoutEffect`), then whenever the available width changes
  (`ResizeObserver` on the sizer, so the container's own height change cannot loop), its content
  changes (`MutationObserver`: sign-in, nav items) or web fonts load. Updates are committed with
  `flushSync`, so a wrong layout is never painted.
- **Hysteresis**: compact as soon as the row does not fit, wide again only with
  `FIT_HYSTERESIS_PX` (24) to spare (avoids flip-flopping when the page scrollbar comes and goes).
- An open compact panel is not re-measured; it is measured again when it closes. Collapsing
  while focus is in the panel moves focus to the button.
- Without `ResizeObserver` (and before hydration) it returns `undefined`: give the layout a CSS
  breakpoint for `:not([data-layout])`.
- Also exported for tests and custom hooks: `decideFitLayout(required, available, current)`
  and `measureFit(element)`.

Why not a "More" menu (priority+)? The nav is any React node (the shell passes a list), so a
generic hook cannot move individual items; and the theme toggle and user menu need a place too.
One panel for everything keeps it simple. In e2e tests open the panel first when the header is
compact (the generated `e2e/helpers.ts` has `openNav(page)` and `openHeaderMenu(page)`, no-ops
when it is wide).
