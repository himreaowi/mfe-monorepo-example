// @ts-check
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { after, describe, it } from 'node:test';

const require = createRequire(import.meta.url);
/** @type {typeof import('../exposed-module.d.ts')} */
const { scanExposedModule } = require('../exposed-module.cjs');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'exposed-'));
after(() => fs.rmSync(root, { recursive: true, force: true }));

/** @param {Record<string, string>} files */
function write(files) {
  for (const [rel, content] of Object.entries(files)) {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
}

describe('scanExposedModule', () => {
  it('walks relative and @/ imports (styles too) and reports forbidden imports', () => {
    write({
      'src/app/apps.tsx':
        "import { routes } from './routes';\nimport { X } from '@/features/x/components/X/X';\n",
      'src/app/routes.tsx': "import { Page } from '@/pages/Page/Page';\n",
      'src/pages/Page/Page.tsx': "import '@org/design-tokens/global.scss';\n",
      'src/features/x/components/X/X.tsx':
        "import styles from './X.module.scss';\nimport { a } from '../../utils';\n",
      'src/features/x/components/X/X.module.scss': '.x { color: red; }\n',
      'src/features/x/utils/index.ts': 'registerPwa();\n',
    });
    const { files, violations } = scanExposedModule(
      path.join(root, 'src/app/apps.tsx'),
    );
    const rel = (/** @type {string} */ f) =>
      path.relative(root, f).split(path.sep).join('/');
    assert.deepEqual(files.map(rel).sort(), [
      'src/app/apps.tsx',
      'src/app/routes.tsx',
      'src/features/x/components/X/X.module.scss',
      'src/features/x/components/X/X.tsx',
      'src/features/x/utils/index.ts',
      'src/pages/Page/Page.tsx',
    ]);
    assert.deepEqual(violations.map((v) => rel(v.file)).sort(), [
      'src/features/x/utils/index.ts',
      'src/pages/Page/Page.tsx',
    ]);
  });
});
