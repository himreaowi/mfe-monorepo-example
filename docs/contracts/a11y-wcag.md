# Contract: accessibility (WCAG 2.2 AA)

## Requirement

Every page of every app MUST meet **WCAG 2.2 Level AA** in the light and the dark theme, on
desktop and at 375 px width. Automated checks run in CI and fail the build on violations.
External (vendor) modules must meet the same level (vendor kit checklist).

## Automated (CI)

| Item         | Requirement                                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Tooling      | axe-core via `@axe-core/playwright` (`checkA11y` in `@org/playwright-config/test`)                                              |
| Rules        | tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22a`, `wcag22aa`                                                          |
| Pages        | per zone: home, 404, every remote in the shell, every private remote's sign-in prompt, every remote standalone (`a11y.spec.ts`) |
| Themes       | light and dark                                                                                                                  |
| Viewports    | desktop 1280×720 and mobile 375×812                                                                                             |
| Failure mode | any violation fails `pnpm e2e:<zone>` and the pipeline                                                                          |
| Exceptions   | only with `exclude`/`disableRules` next to a comment linking a ticket with an owner and a date                                  |

New pages and states (dialogs, menus, error states) get a `checkA11y` call in the feature's
e2e spec after the state is shown.

## Manual (before release of a new flow)

axe covers part of WCAG. For each new or changed flow check:

- [ ] Keyboard only: everything reachable and operable, logical order, no traps, visible focus
      (2.4.7, 2.4.11), skip to content where long nav precedes it (both shell layout starters
      render `SkipLink` from `@org/ui` first; the shell e2e checks it)
- [ ] Screen reader (NVDA + Chrome or VoiceOver + Safari): headings, landmarks, names, states,
      live announcements for status/errors
- [ ] Zoom 200 % and reflow at 320 CSS px (1.4.10) without loss of content or two-way scrolling
      (the shell e2e checks the header at 320 px; a truncated brand is fine because its full
      name is the home page `<h1>` and the document title)
- [ ] Text spacing override (1.4.12) does not clip content
- [ ] Target size ≥ 24×24 CSS px (2.5.8); dragging has a single-pointer alternative (2.5.7)
- [ ] Forms: labels, instructions, error identification and suggestions, no redundant entry
      (3.3.7), accessible authentication (3.3.8: the BFF/IdP flow)
- [ ] Consistent help and navigation across remotes (3.2.6, 3.2.3)
- [ ] Motion respects `prefers-reduced-motion`; nothing flashes
- [ ] Content: meaningful link text, page `<title>`/`<h1>`, language set

## Out of scope

WCAG AAA; audits of third-party sites outside our pages (IdP pages are the IdP's
responsibility, but are checked during integration).
