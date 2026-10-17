// @ts-check
/**
 * Build the kit and pack it as dist/org-vendor-kit-<version>.zip (what we send to vendors or
 * publish to Azure Artifacts as a universal package).
 *   pnpm --filter @org/vendor-kit pack:kit
 */
import path from 'node:path';
import { buildKit } from './build-kit.mjs';
import { DIST_DIR, OUT_DIR } from './paths.mjs';
import { zipDirectory } from './zip.mjs';

const { kitVersion, contractVersion } = await buildKit();
const name = `org-vendor-kit-${kitVersion}`;
const zipFile = path.join(DIST_DIR, `${name}.zip`);
const entries = zipDirectory(OUT_DIR, zipFile, name);
console.log(
  `packed ${entries.length} files (vendor kit ${kitVersion}, mount contract ${contractVersion}) → ${path.relative(process.cwd(), zipFile)}`,
);
