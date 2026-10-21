// @ts-check
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { after, describe, it } from 'node:test';
import { checkEnv, documentedVariables } from '../src/check-env.js';
import { ENV_VARIABLES } from '../src/env.js';
import { app, cleanupWorkspaces, entry, makeWorkspace } from './fixture.js';

after(cleanupWorkspaces);

const ALL = Object.keys(ENV_VARIABLES)
  .map((v) => `# ${v}=\n`)
  .join('');
const GITIGNORE = '.env\n.env.*\n!.env.example\n';

/** @param {Record<string, string | object>} [files] */
function workspace(files = {}) {
  return makeWorkspace({
    apps: {
      'intranet/intranet/shell': app('shell', { type: 'shell', port: 3101 }),
      'intranet/intranet/staff': app('staff', { port: 3111 }),
    },
    files: {
      '.gitignore': GITIGNORE,
      'apps/intranet/intranet/shell/remotes.json': {
        remotes: [entry('intranet', 'staff')],
      },
      'apps/intranet/.env.example': `${ALL}REMOTE_INTRANET_STAFF_URL=\n`,
      ...files,
    },
  });
}
const rules = (/** @type {{ errors: { rule: string }[] }} */ r) =>
  r.errors.map((e) => e.rule);

describe('check-env', () => {
  it('reads documented variables, commented or not', () => {
    assert.deepEqual(
      [...documentedVariables('# A=1\nB=2\n  #C = 3\nnot a var\n#x=1\n')],
      ['A', 'B', 'C'],
    );
  });

  it('passes with a complete zone .env.example', async () => {
    assert.deepEqual(await checkEnv({ root: workspace() }), {
      errors: [],
      warnings: [],
    });
  });

  it('a zone with a shell needs an .env.example documenting every variable and remote', async () => {
    const root = workspace({ 'apps/intranet/.env.example': '' });
    const r = await checkEnv({ root });
    assert.deepEqual(rules(r), ['env-example']);
    assert.match(r.errors[0].message, /API_UPSTREAM/);
    assert.match(r.errors[0].message, /REMOTE_INTRANET_STAFF_URL/);
    assert.deepEqual(
      rules(
        await checkEnv({
          root: makeWorkspace({
            apps: {
              'intranet/intranet/shell': app('shell', {
                type: 'shell',
                port: 3101,
              }),
            },
            files: { '.gitignore': GITIGNORE },
          }),
        }),
      ),
      ['env-example'],
    );
  });

  it('a shell .env.example may only list known variables', async () => {
    const root = workspace({
      'apps/intranet/intranet/.env.example':
        'API_UPSTREAM=\nREMOTE_INTRANET_STAFF_PROPS=\nSECRET_KEY=\n',
    });
    const r = await checkEnv({ root });
    assert.deepEqual(rules(r), ['env-example']);
    assert.match(r.errors[0].message, /SECRET_KEY/);
    assert.doesNotMatch(r.errors[0].message, /API_UPSTREAM/);
  });

  it('fails when a real .env file is tracked by git, .env.example is fine', async () => {
    const root = workspace({
      'apps/intranet/.env': 'API_UPSTREAM=https://secret.example\n',
      'apps/intranet/intranet/.env.uat': 'X=1\n',
    });
    const git = (/** @type {string[]} */ ...args) =>
      execFileSync('git', args, { cwd: root, stdio: 'ignore' });
    git('init', '-q');
    git('add', '-f', '.');
    const r = await checkEnv({ root });
    assert.deepEqual(rules(r), ['env-tracked', 'env-tracked']);
    assert.match(r.errors[0].message, /apps\/intranet\/\.env/);
  });

  it('.gitignore must ignore .env.*; federation names must not collide on case', async () => {
    assert.deepEqual(
      rules(await checkEnv({ root: workspace({ '.gitignore': 'dist\n' }) })),
      ['env-ignored'],
    );
    const root = workspace({
      'apps/intranet/intranet/shell/remotes.json': {
        remotes: [
          entry('intranet', 'staff'),
          { ...entry('intranet', 'staff'), federationName: 'Intranet_staff' },
        ],
      },
    });
    assert.ok(rules(await checkEnv({ root })).includes('env-remote-name'));
  });
});
