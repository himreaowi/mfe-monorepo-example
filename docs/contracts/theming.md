# Contract: theming and design tokens

Normative rules for every app and package. Implementation: `@org/design-tokens` (tokens),
`@org/ui` (`ThemeProvider`, `ThemeToggle`). Guidance: [ui-context.md](../ui-context.md).

## Tokens

| Artifact      | Requirement                                                                       |
| ------------- | --------------------------------------------------------------------------------- |
| CSS variables | `packages/platform/design-tokens/src/tokens.css`, imported once by the page owner |
| Light         | `:root` / `[data-theme='light']`                                                  |
| Dark          | `[data-theme='dark']`                                                             |
| Usage         | themeable values use `var(--…)`; no hardcoded colours on themeable surfaces       |
| Contrast      | every text/background token pair meets WCAG 2.2 AA in both themes                 |
| UI kit        | no third-party component library required                                         |

## Shell layout colours

| Rule      | Requirement                                                                                                                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Owner     | each shell owns its layout and its colours: `src/layouts/ShellLayout/ShellLayout.module.scss` ("HEADER COLOURS": `--header-*` values on the layout root, light and dark), never shared code                              |
| Values    | built from tokens or explicit colours, both themes; the starters map them onto the page token names inside the header, so shared building blocks (`ThemeToggle`, `UserMenu`) follow without options                      |
| Contrast  | text, muted text and accent ≥ 4.5:1 on the header background in both themes; text on the pressed theme button ≥ 4.5:1; text ≥ 4.5:1 on the hover background                                                              |
| Remotes   | MUST NOT set custom properties page-wide (`:root`, `html`, `body`, `[data-theme]`, `document.documentElement.style`): they would restyle the shell's layout and other remotes (`pnpm check` rule `remote-global-tokens`) |
| Selectors | apps MUST NOT select another app's or package's CSS Module class names (hashed per build and app); pass `className` to `@org/ui` building blocks                                                                         |

Details and example: [ui-context.md](../ui-context.md#header-colours).

## ThemeProvider and `data-theme`

| Behaviour    | Requirement                                                               |
| ------------ | ------------------------------------------------------------------------- |
| Attribute    | `data-theme="light"\|"dark"` on `document.documentElement`                |
| Control      | `ThemeToggle`: Light, Dark, Use system theme                              |
| First visit  | `prefers-color-scheme`; fallback `light`                                  |
| After toggle | persisted in `localStorage` (`mfe-theme`), restored on reload             |
| System       | "Use system theme" removes the stored preference and follows the OS again |

## Ownership

| Context                                       | Document theme                                                                                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell                                         | owns it (root `ThemeProvider`)                                                                                                              |
| Remote embedded in the shell                  | MUST NOT take it over: its `ThemeProvider` passes through to the shell's (shared `@org/ui`); a toggle in the remote changes the shell theme |
| Remote with an unshared `@org/ui` (exception) | follower: mirrors `<html>`, requests changes with the `mfe:theme-request` event                                                             |
| Remote standalone                             | owns its page (root `ThemeProvider`)                                                                                                        |
| External (vendor) module                      | gets `theme` as a mount prop (updates via `update()`); styles itself in its shadow root, may read the CSS variables                         |

## Verification

The zone e2e suite (`shell.spec.ts`) checks first visit → system theme, toggle → reload → same
theme, the theme applying to an embedded remote, "Use system theme"; `standalone.spec.ts`
checks every remote standalone owns its theme; `remotes.spec.ts` checks the theme reaching a
vendor module; `a11y.spec.ts` scans every page in both themes (including the header signed in and with the
Menu panel open, so a shell's header colours are checked).
