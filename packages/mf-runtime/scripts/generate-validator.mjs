// Generates src/manifest/validateSchema.generated.js from mfe-manifest.schema.json with Ajv
// "standalone" code generation. The shell bundles only the generated function: no Ajv at
// runtime, no eval / new Function (works under a strict CSP).
//   pnpm --filter @org/mf-runtime generate:validator
// A unit test fails when the generated file is out of date.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateValidatorSource } from './validator-source.mjs';

const dir = join(import.meta.dirname, '..', 'src', 'manifest');
const schema = JSON.parse(
  readFileSync(join(dir, 'mfe-manifest.schema.json'), 'utf8'),
);
writeFileSync(
  join(dir, 'validateSchema.generated.js'),
  generateValidatorSource(schema),
);
console.log('wrote src/manifest/validateSchema.generated.js');
