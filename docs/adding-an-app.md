# Adding an app

Apps are only created with the generators. They write the app from templates, pick a port,
set the metadata the guardrails check, and register remotes with their zone's shell.

```sh
pnpm gen:shell <zone> [<name>] [--base-path /<path>] [--layout top|side] [--title "<text>"]   # zone: intranet | internet
pnpm gen:remote <zone> <name> [--shell <shell>[,<shell>]] [--private] [--state] [--external [--vendor-format esm|web-component|script]] [--title "<text>"]
                                                        # name: kebab-case, e.g. leave-requests
pnpm install                                            # links the new app
```

The generators never overwrite: an existing folder, package name or registry entry is an error.

## Which kind of app?

| You need                                                       | Command                                                                              |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| The zone's host app                                            | `pnpm gen:shell intranet` (`--layout side`: start from the sidebar layout)           |
| Another host app in the zone (own path, layout, sign-in)       | `pnpm gen:shell internet business --base-path /business --layout side`               |
| A feature area everyone can open                               | `pnpm gen:remote intranet staff-directory`                                           |
| A feature area for signed-in users only                        | `pnpm gen:remote internet my-profile --private`                                      |
| UI built by a vendor / another framework / another React major | `pnpm gen:remote internet payments --external` (add `--private` if it needs sign-in) |

`--external` adapters are explained in [external-modules.md](external-modules.md); private
routes in [auth-contract.md](auth-contract.md). Titles default to the name in sentence case with
known acronyms in capitals (`it-helpdesk` → "IT helpdesk"); `--title "Staff portal"` overrides.

## What `gen:remote` creates and changes

```
apps/<zone>/<name>/                 new remote (package @org/<zone>-<name>)
  package.json                      nx.tags zone/type/access(/kind), mfe.port, mfe.federationName
  webpack.config.js                  createRemoteConfig (reads mfe from package.json)
  src/                              app/, features/demo, pages/, layouts/, components/, core/
    features/demo/                  api/, hooks/, types/, utils/, components/<Name>/ (one folder per component), index.ts (public API)
    features/demo/state/            only with --state: demoReducer.ts (+ test), DemoContext.tsx (+ test), used by ItemPicker + SelectionSummary
apps/<zone>/shell-<zone>/
  remotes.json                      + { name, title, path, federationName, package, access, kind }
  mfe-manifest.dev.json             regenerated: + "<federationName>": { "entry": "http://localhost:<port>/mf-manifest.json" }
  package.json (external only)      mfe.devManifest.remotes.<federationName>.props.vendor (the dev mock vendor)
```

| Derived value   | Example (`internet my-profile`)                                                        |
| --------------- | -------------------------------------------------------------------------------------- |
| Folder          | `apps/internet/my-profile`                                                             |
| Package         | `@org/internet-my-profile`                                                             |
| Federation name | `internet_my_profile`                                                                  |
| Route           | `/my-profile/*` in `shell-citizen` (URL `/citizen/my-profile`)                         |
| Nav title       | `My profile` (sentence case; `--title "…"` or edit `remotes.json`)                     |
| Dev port        | lowest free remote port, 3210–3289 (3200 proxy, 3201–3209 shells, 3290–3299 dev tools) |

The zone's e2e suite picks the new remote up from `remotes.json`: deep links, private guard,
standalone mode and the axe scans cover it with no test changes.

## After generating

1. `pnpm install`, then `pnpm dev:<zone>` and open the shell; the new remote is in the nav.
2. Replace the demo: build your feature in `src/features/<name>/` (types → api → hooks → UI,
   one folder per component under `components/`, see
   [coding-conventions.md](coding-conventions.md#one-folder-per-component)), compose it in `src/pages/`, route it in `src/app/routes.tsx` with `routePaths`
   ([coding-conventions.md](coding-conventions.md)). The demo's items list and "Add item" form
   (data from the zone's mock API, `tools/mock-api`) show the API and form patterns; add your
   mock endpoints to `tools/mock-api` while the real API is not there yet. Delete
   `features/demo` and its tests when you no longer need them.
3. Adjust `remotes.json` (`title`, `path`) if the defaults do not fit. Keep `name`,
   `federationName`, `package` and `access` in sync with the remote (`pnpm check` verifies).
4. Mock host props for standalone mode: `standaloneProps` in `src/app/apps.tsx`.
5. Tests: unit tests next to the code; feature flows as `apps/<zone>/shell-<zone>/e2e/<name>.spec.ts`
   ([testing.md](testing.md)).
6. Dependencies: [adding-dependencies.md](adding-dependencies.md) (catalog vs app-local).
7. Gates: `pnpm check && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e:<zone>`.

## Going to production (tell DevOps)

A new app needs, per environment ([devops-handoff.md](devops-handoff.md)):

- a deployment of the app's image (`deploy/Dockerfile --build-arg APP=@org/<zone>-<name>`);
  `pnpm -s apps --json` shows its `distDir`; CI picks it up automatically via
  `pnpm -s apps --affected`,
- its entry in the shell's per-environment `mfe-manifest.json`
  (`"<federationName>": { "entry": "https://…/mf-manifest.json" }`, plus `props.vendor` for
  external adapters); `pnpm -s validate-manifest <file> --zone=<zone>` fails until it is there,
- its origin in the shell's `CSP_REMOTE_ORIGINS` and the shell origin(s) in the remote's
  `MFE_CORS_ORIGINS_REGEX` (not needed for path-based hosting on the shell's origin),
- for external adapters: the vendor origins in the shell's `CSP_VENDOR_ORIGINS`,
- path-based reviewers for the new folder (branch policy).

## Shells

`pnpm gen:shell <zone> [<name>] [--base-path /<path>]` creates `apps/<zone>/shell-<name>` (default
name: the zone) on the next free shell port (3101 / 3201, …) with an empty registry, a dev
manifest with the mock sign-in, the PWA setup and the shell's e2e suite (`e2e/`,
`playwright.config.ts`, run through the zone's dev proxy below the base path). A zone can have
several shells, each with its own base path (unique, not nested, at most one at `/`); the first
shell below a base path in a zone without a `/` shell becomes the zone's default shell (root
`package.json` `mfe.zones.<zone>.defaultShell`, where `/` redirects). With several shells,
`pnpm gen:remote` needs `--shell` (repeat it or comma-separate to list the remote in several
shells; never across zones). Per-shell dev sign-in: `mfe.devManifest.auth.mockUser`
(`{ "id", "name", "roles" }`) in the shell's `package.json`.

The shell owns its layout: `--layout top|side` (default `top`) picks which **starter** is copied
into `src/layouts/ShellLayout/` (`ShellLayout.tsx`, `ShellLayout.module.scss`,
`ShellLayout.test.tsx`): the remotes nav in the header row (`top`) or in a sidebar
left of the content (`side`; many remotes, internal tools). On phones both put it behind the
"Menu" button. After that the files are the shell's own code and there is no layout option:
restyle the header in `ShellLayout.module.scss` ("HEADER COLOURS"), change the structure in
`ShellLayout.tsx`; only this shell is rebuilt. When to choose which and how to switch later:
[ui-context.md](ui-context.md#navigation-top-or-side). Zones are
defined in `tools/scripts/src/zones.js`; a new zone needs a new port range there, an entry in
the boundary rules (`@org/eslint-config`), root `dev:<zone>`/`e2e:<zone>` scripts and a
platform team review.

## Removing or renaming an app

There is no generator for this. To remove a remote: delete `apps/<zone>/<name>`, remove its
entry from the shell's `remotes.json` (and from `mfe.devManifest.remotes` in the shell's
`package.json`, if any), run `pnpm dev-manifest`, `pnpm install` and `pnpm check`, and ask DevOps to remove it from the environment manifests (after the shell
without the route is deployed). Renaming = generating the new remote, moving the code, and
removing the old one (the federation name is part of the runtime contract).
