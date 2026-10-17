// @ts-check
/** Shared paths for the kit scripts. */
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

export const KIT_DIR = path.resolve(import.meta.dirname, '..');
export const DIST_DIR = path.join(KIT_DIR, 'dist');
export const OUT_DIR = path.join(DIST_DIR, 'vendor-kit');
/** Source of the contract and the loader: @org/mf-runtime (single source of truth). */
export const RUNTIME_EXTERNAL_DIR = path.join(
  path.dirname(require.resolve('@org/mf-runtime/package.json')),
  'src',
  'external',
);
export const CONTRACT_DTS = path.join(
  KIT_DIR,
  'contract',
  'mount-contract.d.ts',
);
