# @org/generators

Creates apps from templates. Run from the repo root:

```sh
pnpm gen:shell <zone>                                   # zone: intranet | internet
pnpm gen:remote <zone> <name> [--private] [--external]  # name: kebab-case, e.g. staff-directory
pnpm install
pnpm dev:<zone>
```

| Generator    | Creates                                                                                | Package              | Federation name | Port                          |
| ------------ | -------------------------------------------------------------------------------------- | -------------------- | --------------- | ----------------------------- |
| `gen:shell`  | `apps/<zone>/shell-<zone>`                                                             | `@org/shell-<zone>`  | `<zone>_shell`  | first of the zone (3100/3200) |
| `gen:remote` | `apps/<zone>/<name>` + entry in the shell's `remotes.json` and `mfe-manifest.dev.json` | `@org/<zone>-<name>` | `<zone>_<name>` | lowest free in the zone       |

- Non-interactive. Never overwrites: an existing folder, package name or registry entry is an
  error. `gen:remote` needs the zone's shell (`pnpm gen:shell <zone>` first).
- `--private`: tag `access:private` and `"access": "private"` in the shell registry. The shell
  wraps its route in `<RequireAuth>` (`@org/auth`): signed-out users get a sign-in prompt and the
  remote is not downloaded before sign-in. Every remote receives host prop `user`.
- Shells always render `<AuthProvider>`; the client comes from the manifest's `auth` section
  (`mfe-manifest.dev.json` gets `"auth": { "mock": true }`, the dev-only mock sign-in). See
  `docs/auth-contract.md`.
- `--external`: an **adapter remote** for a vendor module (tag `kind:external`, registry
  `"kind": "external"`). `src/features/external/ExternalModuleHost.tsx` renders
  `<ExternalModule>` (`@org/mf-runtime/external`) configured from the remote's manifest
  `props.vendor` (URL per environment); one splat route, so the vendor routes on `props.path`.
  The dev manifest entry points at the mock vendor (`tools/mock-vendor`, port 3999), the adapter
  falls back to it in development builds, and its `nx.targets.dev.dependsOn` starts it with
  `pnpm dev:<zone>`. The demo feature and details page are not generated. See
  `docs/external-modules.md`.
- Metadata in the generated `package.json`: `nx.tags` (`zone:`, `type:`, `access:`, `kind:`) and
  `mfe` (`port`, `federationName`). `rspack.config.js` reads `mfe` from `package.json`.
- Dependencies: `catalog:` for third-party packages, `workspace:*` for `@org/*`.
- Generated files are formatted with the repo's Prettier config.

Templates live in `templates/shell`, `templates/remote` and `templates/external` (an overlay on
`remote`). Files end in `.tmpl` (so the repo's tools ignore them) and use `__TOKEN__` placeholders
(`__ZONE__`, `__NAME__`, `__APP_TITLE__`, `__PACKAGE_NAME__`, `__FEDERATION_NAME__`,
`__ROUTE_PATH__`, `__PORT__`, `__SHELL_PORT__`, `__ACCESS__`, `__DIR_NAME__`). An unknown token is
an error.

Tests (`pnpm --filter @org/generators test`) generate both zones into a temp workspace and run
`check-apps` / `check-versions` on the result. The full proof (install, lint, typecheck, test,
build, browser) is done in a throwaway copy of the repo; apps are never committed to the
template.
