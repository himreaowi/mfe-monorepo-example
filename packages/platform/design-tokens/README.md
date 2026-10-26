# @org/design-tokens

Design tokens and global styles ported from starter-mfe.

| Export                           | What                                                                                            |
| -------------------------------- | ----------------------------------------------------------------------------------------------- |
| `@org/design-tokens/tokens.css`  | CSS custom properties. Light on `:root` / `[data-theme='light']`, dark on `[data-theme='dark']` |
| `@org/design-tokens/global.scss` | Reset + body/typography defaults (includes tokens.css)                                          |
| `@org/design-tokens`             | `ThemeMode`, `ThemePreference`, `THEME_STORAGE_KEY`, theme attribute/event constants, guards    |

Import the global styles **once, in the app entry that owns the document** (the shell's `src/main.tsx`,
or a remote's standalone `src/main.tsx`). Never import them from a remote's exposed module: the shell
already provides them, and the remote picks up the shell's tokens through CSS variable
inheritance (that is how the shell's theme reaches remotes).

```ts
// src/main.tsx
import '@org/design-tokens/global.scss';
```

Theme switching is done by `ThemeProvider` in `@org/ui` (it sets `data-theme` on `<html>`).
