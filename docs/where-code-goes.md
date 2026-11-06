# Where code goes

Every piece of code has one home. The folder decides who may use it, and `pnpm check` (rule
`package-boundaries`) plus `pnpm lint` (`@nx/enforce-module-boundaries`) enforce the same table.

## Words

- **Zone**: `intranet` or `internet`. Each zone is deployed on its own; the zones never share
  apps.
- **Portal**: `apps/<zone>/<portal>/`, one shell (`shell/`) plus the remotes only that portal
  lists. A zone can have several portals (e.g. internet `citizen` and `business`), each under its
  own base path. (In the code the portal folder is sometimes called the "group folder".)
- **Remote**: a deployable micro-frontend in `apps/<zone>/<portal>/<remote>/`, or in
  `apps/<zone>/shared/<remote>/` when two or more portals list it.
- **Library**: a code package, never deployed alone. The apps that import it bundle its sources.

## The layout

| Folder                           | Package                    | What lives there                                                                 |
| -------------------------------- | -------------------------- | -------------------------------------------------------------------------------- |
| `apps/<zone>/<portal>/shell/`    | `@org/shell-<portal>`      | the portal's shell (layout, sign-in, registry)                                   |
| `apps/<zone>/<portal>/<remote>/` | `@org/<zone>-<remote>`     | a remote only this portal lists                                                  |
| `apps/<zone>/shared/<remote>/`   | `@org/<zone>-<remote>`     | a remote listed by 2+ portals of the zone (**remotes**, not code)                |
| `apps/<zone>/libs/<capability>/` | `@org/<zone>-<capability>` | code shared by the remotes and shells of **one zone** (**code**, not deployable) |
| `packages/common/<capability>/`  | `@org/common-<capability>` | business logic used by **both zones**: public, ships to the internet portals     |
| `packages/platform/<name>/`      | `@org/<name>`              | plumbing: `@org/ui`, design tokens, runtime, auth, configs                       |

`shared/` holds **remotes** (deployable apps) that several portals list; `libs/` holds **code**
that several apps import. `shared` and `libs` are reserved: no portal or remote has these names.

## Decision ladder

Ask in this order and stop at the first "yes":

1. **Used by one remote only?** Keep it in that remote (`src/features/<feature>/` or
   `src/components/<Name>/`). Most code stays here.
2. **Generic UI with no business rules** (a button, a table, a dialog)? → `@org/ui`
   (`packages/platform/ui`, [README](../packages/platform/ui/README.md)).
3. **Shared by apps of one zone?** → `apps/<zone>/libs/<capability>`
   (`pnpm gen:package <zone> <capability>`).
4. **Shared by both zones, and fine to be public?** → `packages/common/<capability>`
   (`pnpm gen:package common <capability>`).
5. **Confidential** (internal rules, staff-only data, anything intranet-only)? → **never**
   `packages/common`. Keep it in the intranet (`apps/intranet/libs/<capability>`) and on the
   backend.

Name a library after what it does (`identity`, `addresses`, `staff-search`), not after who uses
it.

## Common is public

Everything in `packages/common` ships to the internet portals: anyone can read it in the browser.
So:

- no confidential or intranet-only rules, no internal URLs, no secrets;
- client-side rules are a convenience (fast feedback in forms), never the protection: **the
  backend must enforce the same rules**;
- the generated `README.md` and `src/index.ts` of every common package say so.

## Import table

| From ↓ may use →               | `apps/Z/libs/*` | `packages/common/*` | `packages/platform/*` | other apps | other zone |
| ------------------------------ | :-------------: | :-----------------: | :-------------------: | :--------: | :--------: |
| remote / shell in zone Z       |       yes       |         yes         |          yes          |     no     |     no     |
| `apps/Z/libs/<capability>`     |       yes       |         yes         |          yes          |     no     |     no     |
| `packages/common/<capability>` |       no        |         yes         |          yes          |     no     |     no     |
| `packages/platform/<name>`     |       no        |         no          |          yes          |     no     |     no     |

The rules come from the folders alone:

- `pnpm check` (`tools/scripts/src/check-packages.js`) reads every package.json dependency and
  every import in `src/` (by package name and by relative path) and fails with the fix;
- `pnpm lint` uses the Nx tags, which follow the folder: libraries `zone:<zone>` + `type:lib`,
  common `type:common`, platform `type:package` (rule `library-tags` keeps them right). A test in
  `tools/scripts` checks that the lint constraints and the check agree for every pair.

## Library shape

- Package name matches the folder: `@org/common-<capability>`, `@org/<zone>-<capability>`
  (rule `library-name`). A zone library and a remote of the same zone cannot share a name.
- No `mfe` block (no port, no federation name), no webpack config; the front door is
  `src/index.ts` with `"exports": { ".": "./src/index.ts" }` (rule `library-shape`).
- Components: `src/components/<Name>/<Name>.tsx`, `<Name>.module.scss` (when styled),
  `<Name>.test.tsx`; stories optional (rule `library-component-files`).
- An empty or missing `apps/<zone>/libs/` is fine.

## Commands

```sh
pnpm gen:package intranet staff-search    # apps/intranet/libs/staff-search (@org/intranet-staff-search)
pnpm gen:package common identity          # packages/common/identity (@org/common-identity)
pnpm install
pnpm --filter @org/intranet-people add @org/intranet-staff-search@workspace:*
```

Move a component that turned out to be shared:

```sh
pnpm move-component @org/intranet-people StaffPicker --to intranet/libs/staff-search --dry-run
pnpm move-component @org/intranet-people StaffPicker --to intranet/libs/staff-search
```

It `git mv`s `src/**/components/StaffPicker/` into the library's `src/components/`, exports it
from `src/index.ts`, adds the library as a `workspace:*` dependency of the app, copies the
packages the component imports into the library's dependencies, rewrites the app's imports to
`@org/intranet-staff-search`, then runs Prettier, `pnpm install` and `pnpm check`. It refuses
when the library does not exist (run `pnpm gen:package` first) or when the move would break the
import table (e.g. a component that imports zone code cannot go to `packages/common`; one that
imports other app files needs those moved first). Other apps that had their own copy switch to
the library by hand (add the dependency, import from the package, delete the copy).

When `pnpm check` reports `shared-component` (the same component folder in two apps), it names
the right target: `apps/<zone>/libs/<capability>` when both apps are in one zone, otherwise
`packages/common/<capability>` (if it may be public) or `@org/ui` (generic UI).
