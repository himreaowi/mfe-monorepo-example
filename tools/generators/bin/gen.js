#!/usr/bin/env node
// @ts-check
/**
 * CLI:  gen.js shell <zone> [<name>] [--base-path /<path>] [--layout top|side] [--title "<text>"]
 *       gen.js remote <zone> <name> [--shell <shell>[,<shell>]] [--private] [--state] [--external [--vendor-format <f>]] [--title "<text>"]
 * Root scripts: `pnpm gen:shell <zone> [<name>]`, `pnpm gen:remote <zone> <name> [flags]`.
 */
import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  UsageError,
  generateRemote,
  generateShell,
  listShells,
  shellUrl,
} from '../src/index.js';

/** @param {string} root @param {any} zone */
const listShellCount = (root, zone) => listShells(root, zone).length;

const USAGE = `Usage:
  pnpm gen:shell <zone> [<name>] [--base-path /<path>] [--layout top|side] [--title "<text>"]
  pnpm gen:remote <zone> <name> [--shell <shell>] [--private] [--state] [--external [--vendor-format <format>]] [--title "<text>"]
  zone: intranet | internet

Options:
  <name>                  gen:shell: the shell's name (apps/<zone>/shell-<name>); default: the
                          zone (shell-intranet), for a zone's only shell
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
      `\nNext:\n  pnpm install\n  pnpm gen:remote ${zone} <name>${listShellCount(root, zone) > 1 ? ' --shell <shell>' : ''}\n  pnpm dev:${zone}            # every ${zone} shell on ${shellUrl(zone, '/')}${r.basePath === '/' ? '' : `, this one at ${shellUrl(zone, r.basePath)}/`}`,
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
