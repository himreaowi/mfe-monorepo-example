// @ts-check
/**
 * Assemble the vendor kit in dist/vendor-kit/:
 *   README.md, CHECKLIST.md, VERSION.json
 *   contract/mount-contract.d.ts
 *   test-host/  (index.html, host.js, csp.js, host.css, serve.mjs, lib/load.js, lib/contract.js)
 *   examples/   (vanilla ESM, web component)
 * lib/*.js are generated from @org/mf-runtime src/external (the loader the shells run).
 *   pnpm --filter @org/vendor-kit build
 */
import fs from 'node:fs';
import path from 'node:path';
import { browserModule, isContractUpToDate } from './contract-source.mjs';
import { CONTRACT_DTS, KIT_DIR, OUT_DIR } from './paths.mjs';

/** @returns {Promise<{ kitVersion: string, contractVersion: string }>} */
export async function buildKit(outDir = OUT_DIR) {
  // the committed .d.ts must match the runtime contract (no silent drift)
  if (!(await isContractUpToDate())) {
    throw new Error(
      'contract/mount-contract.d.ts is out of date. Run: pnpm --filter @org/vendor-kit generate:contract',
    );
  }
  fs.rmSync(outDir, { recursive: true, force: true });
  const copy = (/** @type {string} */ rel, /** @type {string} */ to = rel) => {
    const target = path.join(outDir, to);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.cpSync(path.join(KIT_DIR, rel), target, { recursive: true });
  };
  copy('kit/README.md', 'README.md');
  copy('kit/CHECKLIST.md', 'CHECKLIST.md');
  copy('contract');
  copy('examples');
  for (const f of [
    'index.html',
    'host.js',
    'csp.js',
    'host.css',
    'serve.mjs',
  ]) {
    copy(`test-host/${f}`);
  }
  fs.mkdirSync(path.join(outDir, 'test-host', 'lib'), { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'test-host', 'lib', 'contract.js'),
    browserModule('contract.ts'),
  );
  fs.writeFileSync(
    path.join(outDir, 'test-host', 'lib', 'load.js'),
    browserModule('load.ts'),
  );

  const kitVersion = JSON.parse(
    fs.readFileSync(path.join(KIT_DIR, 'package.json'), 'utf8'),
  ).version;
  const contractVersion = /MOUNT_CONTRACT_VERSION = ['"]([^'"]+)['"]/.exec(
    fs.readFileSync(CONTRACT_DTS, 'utf8'),
  )?.[1];
  if (!contractVersion)
    throw new Error('MOUNT_CONTRACT_VERSION not found in the contract');
  const version = {
    kitVersion,
    contractVersion,
    builtAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(outDir, 'VERSION.json'),
    `${JSON.stringify(version, null, 2)}\n`,
  );
  return { kitVersion, contractVersion };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const v = await buildKit();
  console.log(
    `vendor kit ${v.kitVersion} (mount contract ${v.contractVersion}) → ${path.relative(process.cwd(), OUT_DIR)}`,
  );
}
