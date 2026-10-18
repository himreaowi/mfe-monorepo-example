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

## Component conventions

- Shared components: `packages/ui/src/components/<Component>/` (`Component.tsx`,
  `Component.module.scss`, `types.ts`, `Component.test.tsx`, `index.ts`). App-only components:
  the app's `src/components/<Component>/`. Feature UI: `src/features/<name>/`.
- Composition first: `children` / slots and small hooks over boolean-prop sprawl.
- No third-party component library by default. Adding one is a tier decision (1 if it holds
  context or theme, 2 if shared) and a platform team review.
- `@org/ui` is a tier-1 singleton: changing it changes every app at runtime; keep it
  backward compatible within a release.

### Shared primitives (`@org/ui`)

| Component                   | Role                                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------- |
| `Button`                    | `primary` / `secondary` / `ghost`                                                             |
| `ThemeToggle`               | Light / Dark / Use system theme                                                               |
| `MainLayout`                | header (brand, nav, theme toggle, actions; collapsible below 40rem), offline banner, `<main>` |
| `RemoteFallback`            | `role="alert"` panel for failed remotes/modules, optional "Try again"                         |
| `ConnectionRequired`        | offline banner                                                                                |
| `ThemeProvider`, `useTheme` | theme state and ownership                                                                     |

From `@org/auth`: `UserMenu`, `RequireAuth` / `SignInPrompt`.

## Layout & composition

- The shell's `ShellLayout` (MainLayout + remote nav + user menu) is the chrome; remotes render
  page content only (one `<h1>` per page, then `h2`…).
- Phone width (375 px) first for primary flows: no horizontal page scrolling. Below 40rem
  `MainLayout` collapses nav, theme toggle and user menu behind a "Menu" button (header one row,
  ≤ 64 px); do not build per-app menus.
- _TODO: max content width, grid/breakpoints, density._

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

- Plain, short sentences; sentence case for headings and buttons.
- Error messages say what happened and what to do ("Could not load your leave balance. Try
  again.").
- Offline: "You are offline" / connection banner from `@org/ui`.
- _TODO: product tone, terminology list._

## Do / don't (for agents)

- Use tokens and `@org/ui` primitives; check both themes.
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
