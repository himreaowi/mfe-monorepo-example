// @ts-check
/**
 * Port of a dev tool of this package, from the root package.json `mfe.tools.<name>.offset`
 * (the same table `pnpm check` validates). Storybook is not per zone: it uses the intranet
 * zone's tools range (3190-3199), see ZONES in tools/scripts/src/zones.js. A package must not
 * import a tool package (Nx module boundaries), hence the constant here.
 */
import fs from 'node:fs';
import path from 'node:path';

/** ZONES.intranet.tools.first (tools/scripts/src/zones.js). */
export const TOOLS_FIRST_PORT = 3190;

/** @param {'storybook' | 'storybookTest'} name */
export function toolPort(name) {
  const file = path.resolve(
    import.meta.dirname,
    '..',
    '..',
    '..',
    '..',
    'package.json',
  );
  const offset = JSON.parse(fs.readFileSync(file, 'utf8')).mfe?.tools?.[name]
    ?.offset;
  if (!Number.isInteger(offset)) {
    throw new Error(
      `${file}: declare "mfe": { "tools": { "${name}": { "offset": <0-9>, "package": "@org/ui" } } } (pnpm check).`,
    );
  }
  return TOOLS_FIRST_PORT + offset;
}
