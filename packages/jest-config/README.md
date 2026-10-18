# @org/jest-config

Shared Jest 30 preset for packages and apps: jsdom (+ Node's `Headers`, `Request`, `Response`;
`fetch` stays undefined), `@swc/jest` transform (TS/TSX and the ESM-only `react-router`),
`identity-obj-proxy` for (S)CSS, Testing Library `jest-dom` matchers, `TextEncoder` and a
`matchMedia` stub.

```js
// jest.config.js
import { createJestConfig } from '@org/jest-config';

export default createJestConfig({ rootDir: import.meta.dirname });
```

`maxWorkers` defaults to `50%` (Nx runs several Jest processes at once; uncapped workers overload
the machine and tests time out) and `testTimeout` to 15 s. Options: `environment` (`jsdom` | `node`), `extraEsmPackages` (more ESM-only packages to
transform), `setupFiles`, `overrides` (merged last).

The consumer needs `jest` (for the binary) and, for types, `@types/jest` and
`@testing-library/jest-dom` in its devDependencies. Every other tool path is resolved from this
package. See `docs/toolchain.md` for why the transform is set up this way.

## Fetch in tests

jsdom has no Fetch API. The preset's environment (`jsdom-environment.cjs`) copies Node's
`Headers`, `Request` and `Response` into it, so `@org/http-client` can run in component tests,
but not `fetch`: unit tests never hit the network. Inject a fake instead:

```ts
import { createFakeFetch, jsonResponse } from '@org/jest-config/fetch';

const fetch = createFakeFetch({ 'GET /api/items': { body: [{ id: 1 }] } });
const http = createHttpClient({ baseUrl: 'http://api.test/api', fetch });
// fetch.calls → [{ url, method, pathname, query, body, init }]
jest.fn().mockResolvedValue(jsonResponse({ message: 'x' }, { status: 500 }));
```

See [docs/testing.md](../../docs/testing.md#testing-api-code-jsdom-has-no-fetch). Tests:
`pnpm --filter @org/jest-config test` (node --test).
