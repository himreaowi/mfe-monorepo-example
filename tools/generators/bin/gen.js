#!/usr/bin/env node
// @ts-check
/**
 * CLI:  gen.js shell <zone> [--layout top|side] [--title "<text>"]
 *       gen.js remote <zone> <name> [--private] [--external [--vendor-format <f>]] [--title "<text>"]
 * Root scripts: `pnpm gen:shell <zone>`, `pnpm gen:remote <zone> <name> [flags]`.
 */
import path from 'node:path';
import { parseArgs } from 'node:util';
import { UsageError, generateRemote, generateShell } from '../src/index.js';

const USAGE = `Usage:
  pnpm gen:shell <zone> [--layout top|side] [--title "<text>"]   zone: intranet | internet
  pnpm gen:remote <zone> <name> [--private] [--external [--vendor-format <format>]] [--title "<text>"]

Options:
  --layout top|side       gen:shell: the starter layout copied into the shell (its own code
                          afterwards): top (default, nav in the header row) or side (nav in a
                          sidebar left of the content); phones: Menu button
  --private               remote needs a signed-in user (tag access:private, marked in the shell registry)
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
      'vendor-format': { type: 'string' },
      title: { type: 'string' },
      layout: { type: 'string' },
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
      name !== undefined ||
      values.private ||
      values.external ||
      values['vendor-format'] !== undefined
    ) {
      throw new UsageError(
        `gen:shell takes only a zone (and --layout, --title).\n\n${USAGE}`,
      );
    }
    const r = await generateShell({
      root,
      zone,
      title: values.title,
      layout: values.layout,
    });
    console.log(
      `Created ${path.relative(root, r.dir)} (${r.packageName}, "${r.title}", federation name ${r.federationName}, port ${r.port}, ${r.layout} starter layout in src/layouts/ShellLayout).`,
    );
    console.log(
      `\nNext:\n  pnpm install\n  pnpm gen:remote ${zone} <name>\n  pnpm dev:${zone}`,
    );
    return;
  }
  if (kind === 'remote') {
    if (values.layout !== undefined) {
      throw new UsageError(
        `--layout applies to gen:shell only (the shell owns the layout).\n\n${USAGE}`,
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
      private: values.private,
      external: values.external,
      vendorFormat: values['vendor-format'],
      title: values.title,
    });
    console.log(
      `Created ${path.relative(root, r.dir)} (${r.packageName}, "${r.entry.title}", federation name ${r.federationName}, port ${r.port}, ${r.entry.access}${r.entry.kind === 'external' ? ', external' : ''}).`,
    );
    console.log(
      `Registered with the ${zone} shell: route ${r.entry.path}/*, dev manifest entry http://localhost:${r.port}/mf-manifest.json.`,
    );
    console.log(
      `\nNext:\n  pnpm install\n  pnpm dev:${zone}            # shell + all ${zone} remotes\n  pnpm --filter ${r.packageName} dev   # this remote standalone`,
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
