# @org/common-identity

Identity: Singapore NRIC/FIN and UEN checks and the NRIC mask, used by the apps of both zones (intranet and internet). Lives in `packages/common/identity`.

> Everything here ships to the internet portals. No confidential or intranet-only rules. The backend must enforce the same rules.
>
> Imports only other packages/common/* and packages/platform/* packages, never zone code.

It is never deployed alone: no port, no webpack config. The apps that import it bundle its
sources (`"exports": { ".": "./src/index.ts" }`).

## What it checks

| Function         | Checks                                                                                                                                                    | Does not check                                                     |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `isValidNric(v)` | NRIC/FIN format (series `S T F G M`, 7 digits, letter) and the check letter (weights 2,7,6,5,4,3,2; mod 11; offset 0 for S and F, 4 for T and G, 3 for M) | that the number was issued or belongs to the person                |
| `isValidUen(v)`  | the common UEN shapes: business `nnnnnnnnX`, local company `yyyynnnnnX`, other entities `T/S/R` + `yy` + 2-letter entity type + `nnnn` + `X`              | the check letter, the entity type code, that the UEN is registered |
| `maskNric(v)`    | nothing: keeps the first character and the last 4 (`S1234567D` becomes `S****567D`); anything shorter than 5 characters is fully masked                   |                                                                    |

Input is trimmed and upper-cased first, so `" s1234567d "` counts as `S1234567D`. Send the
normalised value to the backend or have it normalise the same way.

> The M-series check letters (long-term FINs from 2022) follow the published table as understood
> when this was written; confirm them against an official list before relying on them.

## The backend must enforce the same rules

This package ships to the browser: anyone can read it, skip it or edit the request. The checks
here only give people quick feedback in a form. The backend must validate every value again with
the same rules (and the checks this package cannot do), and must never trust a client-side
check. Show an NRIC only through `maskNric`; do not render the full number.

## Use it in an app

```sh
pnpm --filter <app package> add @org/common-identity@workspace:*
```

```ts
import { isValidNric, isValidUen, maskNric } from '@org/common-identity';

isValidNric('S1234567D'); // true
isValidUen('201912345K'); // true
maskNric('S1234567D'); // 'S****567D'
```

## Layout

- `src/index.ts`: the front door; export everything the apps may use from here.
- `src/components/<Name>/`: one folder per component, `<Name>.tsx`, `<Name>.module.scss`,
  `<Name>.test.tsx` (stories optional).
- `src/utils/`, `src/hooks/`, …: plain functions and hooks, each with its test.

Move a component out of an app: `pnpm move-component <app> <Name> --to common/identity`.

`pnpm check` (rule `package-boundaries`) and `pnpm lint` keep the imports in line with
[docs/where-code-goes.md](../../../docs/where-code-goes.md).
