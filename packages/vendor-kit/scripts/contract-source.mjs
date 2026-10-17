// @ts-check
/**
 * Builds the vendor-facing artefacts from @org/mf-runtime/src/external:
 * - mount-contract.d.ts (types, from contract.ts)
 * - contract.js / load.js (plain ES modules for the test host, from contract.ts / load.ts)
 */
import fs from 'node:fs';
import path from 'node:path';
import * as prettier from 'prettier';
import ts from 'typescript';
import { CONTRACT_DTS, RUNTIME_EXTERNAL_DIR } from './paths.mjs';

const HEADER = `// Mount contract for external modules. GENERATED from @org/mf-runtime
// (src/external/contract.ts) by @org/vendor-kit "generate:contract". Do not edit.
// Types only: the declared constants and functions show the host's values/behaviour.
`;

/** @param {string} file */
function read(file) {
  return fs.readFileSync(path.join(RUNTIME_EXTERNAL_DIR, file), 'utf8');
}

/** @returns {string} the .d.ts text */
export function contractDeclarations() {
  const result = ts.transpileDeclaration(read('contract.ts'), {
    fileName: 'contract.ts',
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      isolatedDeclarations: true,
      declaration: true,
      removeComments: false,
    },
    reportDiagnostics: true,
  });
  if (result.diagnostics?.length) {
    const msg = result.diagnostics
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
      .join('\n');
    throw new Error(`contract.ts cannot be turned into declarations:\n${msg}`);
  }
  return HEADER + result.outputText;
}

/**
 * Plain ES module (ES2022) for the browser. Relative imports get a `.js` extension.
 * @param {'contract.ts' | 'load.ts'} file
 */
export function browserModule(file) {
  const { outputText } = ts.transpileModule(read(file), {
    fileName: file,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      verbatimModuleSyntax: false,
      isolatedModules: true,
    },
  });
  return (
    `// GENERATED from @org/mf-runtime src/external/${file} (same code the shells run). Do not edit.\n` +
    outputText.replace(/from '(\.\/[^'.]+)'/g, "from '$1.js'")
  );
}

/** The declarations formatted like the committed contract/mount-contract.d.ts. */
export async function formattedContractDeclarations() {
  return prettier.format(contractDeclarations(), {
    ...(await prettier.resolveConfig(CONTRACT_DTS)),
    filepath: CONTRACT_DTS,
  });
}

/** `true` when the committed .d.ts matches the runtime contract. */
export async function isContractUpToDate() {
  return (
    fs.existsSync(CONTRACT_DTS) &&
    fs.readFileSync(CONTRACT_DTS, 'utf8') ===
      (await formattedContractDeclarations())
  );
}
