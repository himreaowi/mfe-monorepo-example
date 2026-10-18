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

## Header colours per shell

Each shell can give its header its own colours (e.g. a blue staff portal and a white citizen
portal) with five CSS custom properties read by `MainLayout` (`@org/ui`). Unset, the header
looks exactly as before (it falls back to the page tokens). With `navPlacement="side"` the same
five tokens colour the top bar, the sidebar and the drawer: they are one piece of chrome (the
nav is inside `<header>`), so there is no separate sidebar token and one contrast check covers
both.

| Token                 | Used for                                                                                                      | Fallback when unset                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `--header-bg`         | header and compact Menu panel background; text colour of the pressed theme button; base of the hover tint     | `--color-surface`                          |
| `--header-text`       | brand, nav links (shell `RemoteNav`), Menu button, theme / Sign in buttons                                    | `--color-text`                             |
| `--header-text-muted` | "Theme" label, signed-in user name, Menu button border                                                        | `--header-text`, then `--color-text-muted` |
| `--header-border`     | header bottom border, panel divider, secondary button borders ("Dark", "Sign in")                             | `--color-border`                           |
| `--header-accent`     | active nav link, focus rings, pressed theme button background, ghost buttons ("Use system theme", "Sign out") | `--header-text`, then `--color-accent`     |

How it works: `MainLayout` maps them onto the normal token names (`--color-surface`,
`--color-text`, …) inside the header, so everything rendered there (theme toggle, `UserMenu`,
`RemoteNav`, any `headerActions`) follows without code changes. Hover and "Menu open"
backgrounds become a 14 % tint of `--header-text` over `--header-bg` once `--header-bg` is set.

Where: the shell's own global stylesheet `apps/<zone>/shell-<zone>/src/styles/shell.scss`
(generated with the tokens commented out), imported in `src/bootstrap.tsx` right after
`@org/design-tokens/global.scss`. Set them per theme:

```scss
:root,
[data-theme='light'] {
  --header-bg: #1d4ed8;
  --header-text: #ffffff;
  --header-text-muted: #dbeafe;
  --header-border: #60a5fa;
  --header-accent: #ffffff;
}

[data-theme='dark'] {
  --header-bg: #1e3a8a;
  --header-text: #ffffff;
  --header-text-muted: #bfdbfe;
  --header-border: #3b82f6;
  --header-accent: #ffffff;
}
```

Rules:

- **The header belongs to the shell.** Only the shell sets these tokens; remotes never do
  (`pnpm check` fails when a remote's source or styles set a `--header-*` colour token). A
  remote that set them would recolour the shell's header whenever it is loaded. Standalone, a
  remote shows the default header.
- **Contrast (WCAG 2.2 AA), both themes:** `--header-text`, `--header-text-muted` and
  `--header-accent` each at least 4.5:1 on `--header-bg` (the accent is also active-link text,
  and `--header-bg` is the text colour on the pressed accent button, the same pair); text at
  least 4.5:1 on the hover tint. The example above: text 6.7:1 (light) / 10.4:1 (dark), muted
  5.5:1 / 7.3:1, text on the hover tint 5.0:1 / 7.0:1. Setting only `--header-bg` and
  `--header-text` gives an AA header when that pair passes (on the hover tint too): muted text
  and accent then use the text colour. The
  generated `a11y.spec.ts` scans the header in light and dark (signed in and out, Menu open on
  phones).
- **Do not target MainLayout's class names** (`.header`, `.menuButton`, …) from a shell. They
  are CSS Modules classes: the build replaces them with generated names (a hash salted with the
  app's federation name, different in dev and production, and changing whenever `@org/ui`'s
  styles change), so a selector on them matches nothing after the next build or in another app,
  without any error. The tokens are the supported, stable interface; if you need more than
  colours, ask for a new token or prop in `@org/ui`.

## Component conventions

- Shared components: `packages/ui/src/components/<Component>/` (`Component.tsx`,
  `Component.module.scss`, `types.ts`, `Component.test.tsx`, `index.ts`). App-only components:
  the app's `src/components/<Component>/`. Feature UI: `src/features/<name>/components/<Component>/`,
  same files (one folder per component, its own `.module.scss`, never shared; see
  [coding-conventions.md](coding-conventions.md#one-folder-per-component)).
- Composition first: `children` / slots and small hooks over boolean-prop sprawl.
- No third-party component library by default. Adding one is a tier decision (1 if it holds
  context or theme, 2 if shared) and a platform team review.
- `@org/ui` is a tier-1 singleton: changing it changes every app at runtime; keep it
  backward compatible within a release.

### Shared primitives (`@org/ui`)

| Component                   | Role                                                                                                                                                                          |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`                    | `primary` / `secondary` / `ghost`                                                                                                                                             |
| `ThemeToggle`               | Light / Dark / Use system theme                                                                                                                                               |
| `MainLayout`                | header (brand, nav, theme toggle, actions; one row, collapses when it does not fit), offline banner, `<main>`; nav in the header row or a sidebar (`navPlacement`), skip link |
| `RemoteFallback`            | `role="alert"` panel for failed remotes/modules, optional "Try again"                                                                                                         |
| `ConnectionRequired`        | offline banner                                                                                                                                                                |
| `ThemeProvider`, `useTheme` | theme state and ownership                                                                                                                                                     |

From `@org/auth`: `UserMenu`, `RequireAuth` / `SignInPrompt`.

## Layout & composition

- The shell's `ShellLayout` (MainLayout + remote nav + user menu) is the chrome; remotes render
  page content only (one `<h1>` per page, then `h2`…).
- Phone width (375 px) first for primary flows: no horizontal page scrolling. The header is
  always one row: when brand, nav, theme toggle and user menu do not fit (measured, so it also
  happens on wide screens with many remotes) `MainLayout` collapses them behind a "Menu" button
  (≤ 64 px at 320–375 px, ≤ 80 px wide); do not build per-app menus. Keep nav labels short.
- The header brand (shell title) is always one line: a long name **may be truncated with an
  ellipsis** on narrow screens (and, beyond about 30 characters, between the wide and compact
  layouts). Screen readers still get the full name (the text is only clipped by CSS), but
  sighted users must see it too: the full name must appear as the home page `<h1>` (the
  generated `Welcome` does) and in the document `<title>`. Prefer short shell titles; never put
  information only in the brand.
- _TODO: max content width, grid/breakpoints, density._

### Navigation placement: top or side

`MainLayout` puts the shell's nav (`RemoteNav`) in one of two places (`navPlacement`):

| Placement       | Wide screens                                                                                                                              | Narrow screens                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `top` (default) | one header row: brand, nav, theme toggle, user menu                                                                                       | brand + "Menu"; the panel drops down below the header                                                  |
| `side`          | sticky top bar (brand, theme toggle, user menu) + a 16rem (256 px) sidebar on the left with the links stacked; content to the right of it | brand + "Menu"; the panel is a drawer on the left (at most 20rem, nav first, then theme and user menu) |

Choose **top** for few areas with short names (a citizen site: content first, the full width
for pages). Choose **side** when there are many areas or long names (staff tools, more than
about 6–8 remotes), when users jump between areas all day, or when the header row would
collapse behind "Menu" on laptops anyway.

When it switches: measured like the top header (the same `useHeaderLayout`, not a fixed
breakpoint): the sidebar shows when the top bar row fits **and** the viewport leaves at least
40rem for the content next to the sidebar, so from 56rem (896 px) on; below that the drawer.
The top variant stays as it was (collapses when its row does not fit). A tablet in portrait
(768–800 px) gets the drawer: a 256 px sidebar would leave the page too little room.

How to set or switch it: one prop. `pnpm gen:shell <zone> --layout side` writes it; in an
existing shell change `NAV_PLACEMENT` in `src/layouts/ShellLayout/ShellLayout.tsx`
(`'top'` ↔ `'side'`). Nothing else changes: same tokens, same `RemoteNav` (it reads the
placement with `useNavPlacement()` and stacks its links, active link with a bar), same e2e
suite (it reads `data-nav-placement` from the header and checks the matching layout).

Both placements: one `banner` (`<header>`, holding the named `nav`), one `main`, a "Skip to
main content" link as the first Tab stop (visible on focus). In the side layout the Tab order
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
- Header colours: only the shell's `src/styles/shell.scss` sets `--header-*`; never style
  `MainLayout`'s hashed class names.
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
