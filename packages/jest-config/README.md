# @org/jest-config

Shared Jest 30 preset for packages and apps: jsdom, `@swc/jest` transform (TS/TSX and the
ESM-only `react-router`), `identity-obj-proxy` for (S)CSS, Testing Library `jest-dom` matchers,
`TextEncoder` and a `matchMedia` stub.

```js
// jest.config.js
import { createJestConfig } from '@org/jest-config';

export default createJestConfig({ rootDir: import.meta.dirname });
```

`maxWorkers` defaults to `50%` (Nx runs several Jest processes at once; uncapped workers overload
the machine and tests time out). Options: `environment` (`jsdom` | `node`), `extraEsmPackages` (more ESM-only packages to
transform), `setupFiles`, `overrides` (merged last).

The consumer needs `jest` (for the binary) and, for types, `@types/jest` and
`@testing-library/jest-dom` in its devDependencies. Every other tool path is resolved from this
package. See `docs/toolchain.md` for why the transform is set up this way.
