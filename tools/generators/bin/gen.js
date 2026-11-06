#!/usr/bin/env node
// @ts-check
/**
 * CLI:  gen.js shell <zone> [<name>] [--base-path /<path>] [--layout top|side] [--title "<text>"]
 *       gen.js remote <zone> <name> [--shell <shell>[,<shell>]] [--private] [--state] [--external [--vendor-format <f>]] [--title "<text>"]
 *       gen.js package <common|zone> <capability>
 * Root scripts: `pnpm gen:shell <zone> [<name>]`, `pnpm gen:remote <zone> <name> [flags]`,
 * `pnpm gen:package <common|zone> <capability>`.
 */
import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  UsageError,
  generatePackage,
  generateRemote,
  generateShell,
  listShells,
  shellUrl,
} from '../src/index.js';

/** @param {string} root @param {import('../src/index.js').Zone} zone */
const listShellCount = (root, zone) => listShells(root, zone).length;

const USAGE = `Usage:
  pnpm gen:shell <zone> [<name>] [--base-path /<path>] [--layout top|side] [--title "<text>"]
  pnpm gen:remote <zone> <name> [--shell <shell>] [--private] [--state] [--external [--vendor-format <format>]] [--title "<text>"]
  pnpm gen:package <common|zone> <capability>
  zone: intranet | internet

  A portal is apps/<zone>/<portal>/: one shell (shell/) and the remotes only it lists.
  gen:package creates a code library, never deployed alone (docs/where-code-goes.md):
    common <capability>   packages/common/<capability> (@org/common-<capability>): business
                          logic for both zones. It ships to the public internet portals: no
                          confidential or intranet-only rules; the backend enforces the same rules
    <zone> <capability>   apps/<zone>/libs/<capability> (@org/<zone>-<capability>): code shared
                          by that zone's remotes and shells only

Options:
  <name>                  gen:shell: the portal's name (apps/<zone>/<name>/shell); default:
                          the zone, for a zone's only portal. "shared" and "libs" are reserved
  --base-path /<path>     gen:shell: where the shell is served (default /). Several shells of a
                          zone share one origin, each under its own path (/citizen, /business);
                          pnpm dev:<zone> serves them all on the zone port through a dev proxy
  --shell <shell>         gen:remote: the shell(s) that list the remote (nav + route); required
                          when the zone has several shells; repeat it or comma-separate
  --layout top|side       gen:shell: the starter layout copied into the shell (its own code
                          afterwards): top (default, nav in the header row) or side (nav in a
                          sidebar left of the content); phones: Menu button
  --private               remote needs a signed-in user (tag access:private, marked in the shell registry)
  --state                 add the feature-state example: features/demo/state/ (reducer + test,
                          Context with Provider and hooks), used by two components on the
                          overview page (docs/coding-conventions.md "State management")
  --external              adapter remote for an external/vendor module (tag kind:external)
  --vendor-format <f>     with --external: format of the dev mock vendor config:
                          esm (default) | web-component | script
  --title "<text>"        display title (nav, headings); default from the name in sentence case
                          ("it-helpdesk" → "IT helpdesk", shell: "Intranet shell")
  --root <dir>            workspace root (default: the repo this tool lives in)
  -h, --help              show this help`;

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      private: { type: 'boolean', default: false },
      external: { type: 'boolean', default: false },
      state: { type: 'boolean', default: false },
      'vendor-format': { type: 'string' },
      title: { type: 'string' },
      layout: { type: 'string' },
      'base-path': { type: 'string' },
      shell: { type: 'string', multiple: true },
      root: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  // `pnpm gen:remote -- x` passes a literal "--" through; ignore it.
  const args = positionals.filter((p) => p !== '--');
  if (values.help || args.length === 0) {
    console.log(USAGE);
    return;
  }
  const root = values.root ? path.resolve(values.root) : ROOT;
  const [kind, zone, name, ...extra] = args;

  if (kind === 'shell') {
    if (
      extra.length > 0 ||
      values.shell !== undefined ||
      values.private ||
      values.state ||
      values.external ||
      values['vendor-format'] !== undefined
    ) {
      throw new UsageError(
        `gen:shell takes a zone and an optional name (and --base-path, --layout, --title).\n\n${USAGE}`,
      );
    }
    const z = /** @type {import('../src/index.js').Zone} */ (zone);
    const r = await generateShell({
      root,
      zone,
      name,
      basePath: values['base-path'],
      title: values.title,
      layout: values.layout,
    });
    console.log(
      `Created ${path.relative(root, r.dir)} (${r.packageName}, "${r.title}", federation name ${r.federationName}, base path ${r.basePath}, port ${r.port}, ${r.layout} starter layout in src/layouts/ShellLayout).`,
    );
    if (r.defaultShell) {
      console.log(
        `No ${zone} shell sits at /: the root package.json now redirects / to it (mfe.zones.${zone}.defaultShell).`,
      );
    }
    console.log(
      `\nNext:\n  pnpm install\n  pnpm gen:remote ${zone} <name>${listShellCount(root, z) > 1 ? ' --shell <shell>' : ''}\n  pnpm dev:${zone}            # every ${zone} shell on ${shellUrl(z, '/')}${r.basePath === '/' ? '' : `, this one at ${shellUrl(z, r.basePath)}/`}`,
    );
    return;
  }
  if (kind === 'remote') {
    if (values.layout !== undefined || values['base-path'] !== undefined) {
      throw new UsageError(
        `--layout and --base-path apply to gen:shell only (the shell owns its layout and path).\n\n${USAGE}`,
      );
    }
    if (extra.length > 0) {
      throw new UsageError(
        `Unexpected arguments: ${extra.join(' ')}\n\n${USAGE}`,
      );
    }
    const r = await generateRemote({
      root,
      zone,
      name,
      shells: values.shell,
      private: values.private,
      external: values.external,
      vendorFormat: values['vendor-format'],
      title: values.title,
      state: values.state,
    });
    console.log(
      `Created ${path.relative(root, r.dir)} (${r.packageName}, "${r.entry.title}", federation name ${r.federationName}, port ${r.port}, ${r.entry.access}${r.entry.kind === 'external' ? ', external' : ''}).`,
    );
    console.log(
      `Registered with ${r.shells.map((s) => `shell-${s.name}`).join(', ')}: route ${r.entry.path}/*, dev manifest entry http://localhost:${r.port}/mf-manifest.json.`,
    );
    console.log(
      `\nNext:\n  pnpm install\n  pnpm dev:${zone}            # every ${zone} shell + remote: ${r.shells.map((s) => s.url).join(', ')}\n  pnpm --filter ${r.packageName} dev   # this remote standalone`,
    );
    return;
  }
  if (kind === 'package') {
    const flags = Object.entries(values).filter(
      ([key, value]) =>
        !['root', 'help'].includes(key) &&
        value !== undefined &&
        value !== false,
    );
    if (extra.length > 0 || flags.length > 0) {
      throw new UsageError(
        `gen:package takes a target (common or a zone) and a capability name, no options.\n\n${USAGE}`,
      );
    }
    const r = await generatePackage({ root, target: zone, capability: name });
    console.log(
      `Created ${path.relative(root, r.dir)} (${r.packageName}, ${r.target === 'common' ? 'common: both zones, ships to the public internet portals' : `${r.target} zone library`}).`,
    );
    console.log(
      `\nNext:\n  pnpm install\n  pnpm --filter <app package> add ${r.packageName}@workspace:*\n  pnpm move-component <app> <Component> --to ${r.target === 'common' ? 'common' : `${r.target}/libs`}/${name}   # move existing code in`,
    );
    return;
  }
  throw new UsageError(`Unknown generator "${kind}".\n\n${USAGE}`);
}

main().catch((error) => {
  if (
    error instanceof UsageError ||
    error?.code?.startsWith?.('ERR_PARSE_ARGS')
  ) {
    console.error(`error: ${error.message}`);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
