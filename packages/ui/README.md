# @org/ui

Shared React components ported from starter-mfe (same markup, classes and tokens).

| Export                        | Notes                                                                                                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`                      | `variant`: `primary` (default) / `secondary` / `ghost`                                                                                                                  |
| `ThemeToggle`                 | Light / Dark / Use system theme (needs a `ThemeProvider` above)                                                                                                         |
| `RemoteFallback`              | `role="alert"` panel; optional `onRetry` adds a "Try again" button                                                                                                      |
| `ConnectionRequired`          | Offline banner (`visible`)                                                                                                                                              |
| `MainLayout`                  | Header (brand, `nav`, theme toggle, `headerActions`) + offline banner + `<main>`; renders `children` or `<Outlet />`. Below 40rem: collapsible "Menu" panel (see below) |
| `ThemeProvider`, `useTheme()` | Light/dark/system theme, sets `data-theme` on `<html>`                                                                                                                  |

`@org/ui` is a **tier-1 singleton**: `@org/rspack-config` shares it through Module Federation
(`singleton`, `strictVersion`, `requiredVersion` = this package's version). A remote rendered in a
shell therefore uses the shell's copy of these components, styles and the `ThemeContext`.

Styles are SCSS modules that read CSS variables from `@org/design-tokens`. The app that owns the
page imports `@org/design-tokens/global.scss` once.

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

## MainLayout on phones

From 40rem up the header is one row: brand, `nav`, theme toggle, `headerActions`. Below 40rem
the header shows only the brand and a **Menu** button (one row, about 60 px tall at 375 px); the
nav, the theme toggle and `headerActions` (e.g. `UserMenu`) move into a panel below it:

- the button has `aria-expanded` and `aria-controls` (the panel's id); the panel is
  `display: none` while closed, so it is out of the tab order and the accessibility tree;
- it closes on **Escape** (focus back on the button), on a **click outside** the header, after a
  **link inside it is followed** (and on browser back/forward); if focus was inside the panel it
  moves to the button;
- props: `navLabel` (name of the `<nav>` landmark, default `Main`), `menuLabel` (default `Menu`).

Apps pass plain links or a list as `nav` and need no menu code of their own. In e2e tests open
the panel first at 375 px (the generated `e2e/helpers.ts` has `openNav(page)`).
