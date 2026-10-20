# UI context

<!--
  PURPOSE
  Evergreen UI / visual / component guidance for humans and agents (IDE-agnostic).
  Fill the TODO sections for your product; update after sessions that lock visual or
  component decisions.

  RELATED DOCS (do not duplicate their jobs)
  - docs/coding-conventions.md        → code structure, data fetching, features
  - docs/project-overview.md          → product what/who/flows/scope
  - docs/contracts/theming.md         → normative theme/token requirements
  - docs/contracts/a11y-wcag.md       → WCAG 2.2 AA requirements and CI
  - .specify/memory/constitution.md   → composition-first UI, responsive/PWA
-->

## Design language / brand

_TODO: Brand / visual direction for this product (tone, colours, reference sites, what to
avoid). Until then: template tokens only, no external brand._

## Design tokens

**Location:** `packages/design-tokens/src/tokens.css` (CSS custom properties) + base styles in
`packages/design-tokens/src/global.scss`. Imported once by the shell (`@org/design-tokens/global.scss`);
remotes inherit the variables from `<html>`.

| Token / group                               | Purpose                                |
| ------------------------------------------- | -------------------------------------- |
| `--color-bg`, `--color-surface`             | page background, panels/cards          |
| `--color-text`, `--color-text-muted`        | body text, secondary text              |
| `--color-accent`, `--color-accent-contrast` | primary actions, links; text on accent |
| `--color-border`                            | borders, dividers                      |
| `--color-danger`, `--color-danger-bg`       | errors, alerts                         |
| `--space-1` … `--space-8`                   | spacing scale (1, 2, 3, 4, 6, 8)       |
| `--radius`, `--shadow`                      | corner radius, elevation               |
| `--font-sans`                               | font stack                             |

Rules:

- Components consume `var(--…)`; no hardcoded hex/px for themeable values.
- Light values on `:root` / `[data-theme='light']`, dark on `[data-theme='dark']`. A new colour
  token needs both, and both must meet WCAG 2.2 AA contrast with the surfaces it is used on
  (the e2e axe scan runs in both themes).
- Add tokens in `@org/design-tokens` (one pull request, reviewed by the platform team); do not
  define app-local colour variables that duplicate them.

## Theming

`ThemeProvider` (`@org/ui`) sets `data-theme="light|dark"` on `<html>`; `ThemeToggle` offers
Light / Dark / Use system theme. Rules: [contracts/theming.md](contracts/theming.md).

Ownership: the shell's provider owns the document; a remote's provider passes through to it
(shared `@org/ui`), so a remote never changes the document theme on its own. Standalone, the
remote's provider owns its page. External (vendor) modules get `theme` as a mount prop and may
read the CSS variables.

_TODO: product-specific theme UX (e.g. high-contrast theme), if any._

## Layout: the shell owns it

Each shell owns its layout: `apps/<zone>/shell-<name>/src/layouts/ShellLayout/` is ordinary
code of that shell (`ShellLayout.tsx`, `ShellLayout.module.scss`, `ShellLayout.test.tsx`). `pnpm gen:shell <zone> [--layout top|side]` copies a **starter** there once; after
that there is no layout option anywhere: the team edits the files. `@org/ui` gives building
blocks only (`SkipLink`, `Brand`, `ThemeToggle`, `useMenuDisclosure`, `useFitLayout`, …), so
the hard parts (accessibility, the collapsing header) behave the same in every shell while the
look and structure can differ freely.

Why: two shells can look different (a blue staff portal with a sidebar, a white citizen site
with a top nav) without adding options to shared code, and restyling one shell rebuilds and
redeploys only that shell. `@org/ui` is a tier-1 singleton that every app depends on, so a
layout inside it meant that any header change rebuilt every app.

| You want to …                        | Edit                                                                                                                                                                                   |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| change the header / sidebar colours  | the "HEADER COLOURS" block at the top of `ShellLayout.module.scss` (light values on `.host`, dark on `:global([data-theme='dark']) .host`)                                             |
| change spacing, sizes, breakpoints   | `ShellLayout.module.scss` (the side starter's widths are `$sidebar-width`, `$side-main-min-width`, `$side-drawer-width`)                                                               |
| move the nav (top ↔ side), add items | `ShellLayout.tsx`; to switch completely, copy the other starter from `tools/generators/templates/shell-layouts/<top\|side>/` and replace the `__APP_TITLE__` / `__ZONE__` placeholders |
| add a footer, a logo, a search box   | `ShellLayout.tsx` + `.module.scss` (keep one `banner`, one `main`, the skip link first)                                                                                                |
| change something for the whole page  | `src/styles/shell.scss` (shell-wide globals: fonts, a page token override for this shell and its remotes)                                                                              |

### Header colours

The starters read seven values, declared once on the layout root (`.host`) and mapped onto the
normal token names (`--color-surface`, `--color-text`, …) inside the header, so everything
rendered there (theme toggle, `UserMenu`, `RemoteNav`, the Menu button, the panel, the sidebar
and the drawer) follows without code changes. Unchanged, they are the page tokens (the default
white / dark header):

| Value                 | Used for                                                                                           | Default                   |
| --------------------- | -------------------------------------------------------------------------------------------------- | ------------------------- |
| `--header-bg`         | header, Menu panel, sidebar and drawer background                                                  | `--color-surface`         |
| `--header-text`       | brand, nav links, Menu button, theme / Sign in buttons                                             | `--color-text`            |
| `--header-text-muted` | "Theme" label, signed-in user name, Menu button border                                             | `--color-text-muted`      |
| `--header-border`     | bottom border, panel divider, secondary button borders                                             | `--color-border`          |
| `--header-accent`     | active nav link, focus rings, pressed theme button, ghost buttons ("Use system theme", "Sign out") | `--color-accent`          |
| `--header-on-accent`  | text on the pressed theme button                                                                   | `--color-accent-contrast` |
| `--header-hover`      | hover and "Menu open" background                                                                   | `--color-bg`              |

These are local to the shell's layout (declared on its root element): nothing else reads them,
and a remote cannot change them. A blue header (the example in the starter's comment):

```scss
.host {
  --header-bg: #1d4ed8;
  --header-text: #ffffff;
  --header-text-muted: #dbeafe;
  --header-border: #60a5fa;
  --header-accent: #ffffff;
  --header-on-accent: var(--header-bg);
  --header-hover: color-mix(in srgb, var(--header-text) 14%, var(--header-bg));
  /* … the rest of .host as generated */
}

:global([data-theme='dark']) .host {
  --header-bg: #1e3a8a;
  --header-text: #ffffff;
  --header-text-muted: #bfdbfe;
  --header-border: #3b82f6;
  --header-accent: #ffffff;
}
```

**Contrast (WCAG 2.2 AA), both themes:** `--header-text`, `--header-text-muted` and
`--header-accent` each at least 4.5:1 on `--header-bg`; `--header-on-accent` at least 4.5:1 on
`--header-accent`; text at least 4.5:1 on `--header-hover`. The example: text 6.7:1 (light) /
10.4:1 (dark), muted 5.5:1 / 7.3:1, text on the hover tint 5.0:1 / 7.0:1. The generated
`a11y.spec.ts` scans the header in light and dark (signed in and out, Menu open on phones).

### What stays shared, and why

| Shared (`@org/ui`, `@org/auth`)                | Why                                                                                           |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `SkipLink`                                     | first Tab stop, focuses `<main>` without a router navigation: easy to get subtly wrong        |
| `Brand`                                        | one-line ellipsis that keeps the full accessible name (no tooltip, no hidden copy)            |
| `ThemeToggle`, `ThemeProvider`                 | one theme state for the shell and all remotes                                                 |
| `useMenuDisclosure`                            | the Menu button + panel/drawer behaviour (ARIA, Escape, focus, outside click, link, back)     |
| `useFitLayout`                                 | the measured "does the header row fit" switch (no fixed breakpoint, no flicker, no flip-flop) |
| `UserMenu` (`@org/auth`), `ConnectionRequired` | session and offline state                                                                     |

Everything visual (markup, class names, colours, spacing, nav position) is in the shell.

Rules:

- **The layout belongs to the shell.** Remotes render page content only; they never set CSS
  custom properties for the whole page (`:root`, `html`, `body`, `[data-theme]`), which would
  restyle the shell's layout and the other remotes (`pnpm check` rule `remote-global-tokens`),
  and they cannot import a shell (`app-import`). Standalone, a remote shows its own small
  `StandaloneLayout`.
- **Do not target another app's or package's class names** (`@org/ui`'s `.skipLink`, a remote's
  classes, …): they are CSS Modules classes, renamed per app (`SkipLink_skipLink__x3Yb1`, with a hash that changes), so such a
  selector silently stops matching. Pass a `className` to the building block instead.

## Component conventions

- Shared components: `packages/ui/src/components/<Component>/` (`Component.tsx`,
  `Component.module.scss`, `types.ts`, `Component.test.tsx`; no `index.ts`: the package's
  `src/index.ts` exports each component from its file). App-only components:
  the app's `src/components/<Component>/`. Feature UI: `src/features/<name>/components/<Component>/`,
  same files (one folder per component, its own `.module.scss`, never shared; see
  [coding-conventions.md](coding-conventions.md#one-folder-per-component)).
- Composition first: `children` / slots and small hooks over boolean-prop sprawl.
- No third-party component library by default. Adding one is a tier decision (1 if it holds
  context or theme, 2 if shared) and a platform team review.
- `@org/ui` is a tier-1 singleton: changing it changes every app at runtime; keep it
  backward compatible within a release.

### Shared primitives (`@org/ui`)

| Export                      | Role                                                                  |
| --------------------------- | --------------------------------------------------------------------- |
| `Button`                    | `primary` / `secondary` / `ghost`                                     |
| `ThemeToggle`               | Light / Dark / Use system theme                                       |
| `SkipLink`                  | "Skip to main content", first Tab stop                                |
| `Brand`                     | app name on one line (ellipsis), full accessible name                 |
| `useMenuDisclosure`         | Menu button + panel/drawer behaviour (headless)                       |
| `useFitLayout`              | measures whether the header row fits (`wide` / `compact`)             |
| `RemoteFallback`            | `role="alert"` panel for failed remotes/modules, optional "Try again" |
| `ConnectionRequired`        | offline banner                                                        |
| `ThemeProvider`, `useTheme` | theme state and ownership                                             |

No layout component: layouts are owned by the apps (see "Layout: the shell owns it").

From `@org/auth`: `UserMenu`, `RequireAuth` / `SignInPrompt`.

## Layout & composition

- The shell's own `ShellLayout` is the chrome; remotes render page content only (one `<h1>` per
  page, then `h2`…).
- Phone width (375 px) first for primary flows: no horizontal page scrolling. In both starters
  the header is always one row: when brand, nav, theme toggle and user menu do not fit
  (measured with `useFitLayout`, so it also happens on wide screens with many remotes) they
  collapse behind a "Menu" button (≤ 64 px at 320–375 px, ≤ 80 px wide); remotes do not build
  menus of their own. Keep nav labels short.
- The header brand (shell title) is always one line: a long name **may be truncated with an
  ellipsis** on narrow screens (and, beyond about 30 characters, between the wide and compact
  layouts). Screen readers still get the full name (the text is only clipped by CSS), but
  sighted users must see it too: the full name must appear as the home page `<h1>` (the
  generated `Welcome` does) and in the document `<title>`. Prefer short shell titles; never put
  information only in the brand.
- _TODO: max content width, grid/breakpoints, density._

### Navigation: top or side

The two starters differ in where the shell's nav (`RemoteNav`) goes:

| Starter         | Wide screens                                                                                                                              | Narrow screens                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `top` (default) | one header row: brand, nav, theme toggle, user menu                                                                                       | brand + "Menu"; the panel drops down below the header                                                  |
| `side`          | sticky top bar (brand, theme toggle, user menu) + a 16rem (256 px) sidebar on the left with the links stacked; content to the right of it | brand + "Menu"; the panel is a drawer on the left (at most 20rem, nav first, then theme and user menu) |

Choose **top** for few areas with short names (a citizen site: content first, the full width
for pages). Choose **side** when there are many areas or long names (staff tools, more than
about 6–8 remotes), when users jump between areas all day, or when the header row would
collapse behind "Menu" on laptops anyway.

When it switches: measured (`useFitLayout`), not a fixed breakpoint. Top: compact when the row
does not fit. Side: the sidebar shows when the top bar row fits **and** the viewport leaves at
least 40rem for the content next to the sidebar, so from 56rem (896 px) on; below that the
drawer. A tablet in portrait (768–800 px) gets the drawer: a 256 px sidebar would leave the page
too little room.

How to choose or switch: `pnpm gen:shell <zone> --layout side` copies the side starter. In an
existing shell, edit `src/layouts/ShellLayout/` (or copy the other starter from
`tools/generators/templates/shell-layouts/` over it and re-apply your colours); `RemoteNav`
takes `orientation="vertical"` for a sidebar. The generated e2e suite follows the layout the
page shows: it reads `data-nav-placement="top|side"` from the header (the starters set it; see
the list of hooks at the top of `e2e/helpers.ts`).

Both starters: one `banner` (`<header>`, holding the named `nav`), one `main`, a "Skip to main
content" link as the first Tab stop (visible on focus). In the side layout the Tab order
follows the visual order (top bar, then sidebar, then content) and the top bar is sticky, so
the page reserves 5.5rem at the top when it scrolls to a focused element (WCAG 2.4.11).

## Typography & iconography

_TODO: fonts (self-hosted from the shell origin keeps the CSP simple), type scale, icon approach
(inline SVG components with `aria-hidden` + visible or `aria-label` text)._

## Motion

- Subtle transitions only, inside `@media (prefers-reduced-motion: no-preference)`.
- _TODO: product motion rules._

## Accessibility

Target WCAG 2.2 AA: [contracts/a11y-wcag.md](contracts/a11y-wcag.md). UI rules:

- Every interactive element is reachable and operable by keyboard with a visible focus
  indicator; target size at least 24×24 CSS px.
- Icon-only buttons have an accessible name; form fields have labels; errors are announced
  (`role="alert"` or `aria-live`) and linked to the field.
- Forms validate on submit and then show an error summary (links to the fields) plus an error
  next to each field (`aria-describedby`, `aria-invalid`); submit is only disabled while
  sending. Details: [coding-conventions.md](coding-conventions.md#input-validation-and-forms).
- Loading and status messages use `role="status"`; failures use `role="alert"`.
- Do not convey information by colour alone.

## Content & copy

- Plain, short sentences; sentence case for headings, buttons and app titles. The generators
  derive titles from app names in sentence case, keeping known acronyms in capitals
  (`it-helpdesk` → "IT helpdesk", `staff-directory` → "Staff directory"); `--title` overrides.
- Error messages say what happened and what to do ("Could not load your leave balance. Try
  again.").
- Offline: "You are offline" / connection banner from `@org/ui`.
- _TODO: product tone, terminology list._

## Do / don't (for agents)

- Use tokens and `@org/ui` primitives; check both themes.
- Header colours and layout: edit the shell's own `src/layouts/ShellLayout/`; never style
  another package's hashed class names, never set page-wide custom properties from a remote.
- Do not import global styles or set `data-theme` from a remote's exposed module.
- Do not add a UI kit or icon font without approval.
- Keep one `<h1>` per page and logical heading order.
- _TODO: add rules as you lock decisions._

## Links

| Doc                                              | Role                          |
| ------------------------------------------------ | ----------------------------- |
| [coding-conventions.md](coding-conventions.md)   | code structure, data fetching |
| [project-overview.md](project-overview.md)       | product framing               |
| [contracts/theming.md](contracts/theming.md)     | theme/token rules             |
| [contracts/a11y-wcag.md](contracts/a11y-wcag.md) | WCAG 2.2 AA                   |
| `packages/design-tokens/src/tokens.css`          | live token values             |
| `packages/ui/src/providers/ThemeProvider/`       | theme implementation          |
