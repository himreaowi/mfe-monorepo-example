# @org/scripts

Repo guardrails and small app tools.

| Command / export                          | What                                                                                                      |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `pnpm check` (`bin/check.js`)             | `check-versions` + `check-apps`; `--only versions\|apps`; exit 1 on errors. Part of `pnpm lint`           |
| `checkVersions({ root, today? })`         | D4 tiers: catalog use, exceptions, shared deps → catalog, tier-1 list = MF singletons                     |
| `checkApps({ root })`                     | app location, tags, ports, federation names, no app → app deps/imports, shell registries                  |
| `pnpm e2e [--zone=<zone>]` (`bin/e2e.js`) | runs each zone's e2e suite (`pnpm --filter <shell> e2e`), one zone at a time; extra args go to Playwright |
| `mfe-preview` (bin, app `pnpm preview`)   | serves an app's `dist/` on its `mfe.port` with CORS and SPA fallback; `--manifest <file>` for shells      |
| `ZONES` (`@org/scripts/zones`)            | zones and port ranges (used by the generators)                                                            |

Every failure and its fix: [docs/guardrails.md](../../docs/guardrails.md). Tests:
`pnpm --filter @org/scripts test` (fixture workspaces in a temp dir).
