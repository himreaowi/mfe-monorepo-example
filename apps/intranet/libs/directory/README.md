# @org/intranet-directory

Directory: code used by the intranet apps only (remotes and shells of the intranet zone). Lives in `apps/intranet/libs/directory`.

> Never imported by the other zone or by packages/common. Imports only apps/intranet/libs/_, packages/common/_ and packages/platform/*, never a remote or shell.

It is never deployed alone: no port, no webpack config. The apps that import it bundle its
sources (`"exports": { ".": "./src/index.ts" }`).

## Use it in an app

```sh
pnpm --filter <app package> add @org/intranet-directory@workspace:*
```

```ts
import { formatLabel } from '@org/intranet-directory';
```

## Layout

- `src/index.ts`: the front door; export everything the apps may use from here.
- `src/components/<Name>/`: one folder per component, `<Name>.tsx`, `<Name>.module.scss`,
  `<Name>.test.tsx` (stories optional).
- `src/utils/`, `src/hooks/`, …: plain functions and hooks, each with its test.

Move a component out of an app: `pnpm move-component <app> <Name> --to intranet/libs/directory`.

`pnpm check` (rule `package-boundaries`) and `pnpm lint` keep the imports in line with
[docs/where-code-goes.md](../../../../docs/where-code-goes.md).
