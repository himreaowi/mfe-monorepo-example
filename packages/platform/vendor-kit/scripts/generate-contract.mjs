// @ts-check
// Regenerates contract/mount-contract.d.ts from @org/mf-runtime src/external/contract.ts.
//   pnpm --filter @org/vendor-kit generate:contract
// The kit build and a unit test fail when the committed file is stale.
import fs from 'node:fs';
import { formattedContractDeclarations } from './contract-source.mjs';
import { CONTRACT_DTS } from './paths.mjs';

fs.writeFileSync(CONTRACT_DTS, await formattedContractDeclarations());
console.log('wrote contract/mount-contract.d.ts');
