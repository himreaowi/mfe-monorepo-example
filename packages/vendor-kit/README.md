# @org/vendor-kit

What we hand to external vendors (decision D3: vendors have **no repo access**). They build a
module against the mount contract, test it with the standalone test host and deliver a hosted
bundle. Internal guide (decision table, onboarding, security):
[docs/external-modules.md](../../docs/external-modules.md).

| Path                            | What                                                                                                  |
| ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `contract/mount-contract.d.ts`  | Contract types, **generated** from `@org/mf-runtime` `src/external/contract.ts` (single source)       |
| `test-host/`                    | Standalone page (plain JS + strict CSP) that loads a bundle URL, mounts it, logs callbacks, checks it |
| `examples/`                     | Minimal vendor modules: vanilla ESM, web component                                                    |
| `kit/README.md`, `CHECKLIST.md` | Vendor-facing docs (become the kit's `README.md` / `CHECKLIST.md`)                                    |
| `scripts/`                      | `generate:contract`, `build`, `pack:kit` (zip writer without dependencies)                            |

```sh
pnpm --filter @org/vendor-kit generate:contract   # after changing mf-runtime src/external/contract.ts
pnpm --filter @org/vendor-kit build               # → dist/vendor-kit/ (lib/load.js from mf-runtime)
pnpm --filter @org/vendor-kit pack:kit            # → dist/org-vendor-kit-<version>.zip
pnpm --filter @org/vendor-kit serve               # build + test host on http://localhost:3998/test-host/
```

The test host imports `lib/load.js` and `lib/contract.js`, generated at build time from
`@org/mf-runtime/src/external/{load,contract}.ts` with the TypeScript transpiler, so a vendor
tests against exactly the loading code the shells run. The build fails if
`contract/mount-contract.d.ts` is stale; a unit test checks it too.

Distribution: send the zip, or publish it to Azure Artifacts as a Universal Package
(`az artifacts universal publish --name org-vendor-kit --version <kit version> --path dist/vendor-kit`).
Bump `version` in `package.json` when the kit changes; the contract version is
`MOUNT_CONTRACT_VERSION` in mf-runtime (a MAJOR bump needs a migration plan with every vendor).

Try it with our dev mock vendor (`tools/mock-vendor`, port 3999):

```sh
pnpm --filter @org/mock-vendor dev &
pnpm --filter @org/vendor-kit serve
# http://localhost:3998/test-host/?url=http://localhost:3999/mount.js&format=esm&autoMount=1
```
