import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const root = new URL('../../../', import.meta.url);

// @org/eslint-config reads the app names (apps/<zone>/<portal>/<app>/package.json) when ESLint
// loads. Nx must treat those files as lint inputs, or adding an app reuses stale cached results.
test('lint cache inputs include the package.json of every app and package', () => {
  const nx = JSON.parse(fs.readFileSync(new URL('nx.json', root), 'utf8'));
  const inputs = nx.targetDefaults.lint.inputs;
  assert.ok(inputs.includes('{workspaceRoot}/apps/*/*/*/package.json'));
  assert.ok(inputs.includes('{workspaceRoot}/packages/*/*/package.json'));
});
