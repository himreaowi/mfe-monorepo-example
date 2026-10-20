// @ts-check
/** Builds throwaway fixture workspaces for the check tests. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const CATALOG = {
  react: '19.3.1',
  'react-dom': '19.3.1',
  'react-router': '8.4.0',
  typescript: '6.0.3',
  'date-fns': '4.1.0',
};
export const TIER1 = ['react', 'react-dom', 'react-router', '@org/ui'];

/**
 * @param {string} name e.g. staff
 * @param {{ zone?: string, type?: 'shell' | 'remote', port?: number, access?: string, tags?: string[], deps?: Record<string, string>, devDeps?: Record<string, string>, federationName?: string, extra?: Record<string, unknown> }} [o]
 */
export function app(name, o = {}) {
  const zone = o.zone ?? 'intranet';
  const type = o.type ?? 'remote';
  return {
    name: type === 'shell' ? `@org/shell-${zone}` : `@org/${zone}-${name}`,
    version: '0.0.0',
    private: true,
    nx: {
      tags: o.tags ?? [
        `zone:${zone}`,
        `type:${type}`,
        `access:${o.access ?? 'public'}`,
      ],
    },
    mfe: {
      port: o.port,
      federationName:
        o.federationName ??
        (type === 'shell'
          ? `${zone}_shell`
          : `${zone}_${name.replaceAll('-', '_')}`),
    },
    dependencies: {
      '@org/ui': 'workspace:*',
      react: 'catalog:',
      'react-dom': 'catalog:',
      'react-router': 'catalog:',
      ...(o.deps ?? {}),
    },
    devDependencies: { typescript: 'catalog:', ...(o.devDeps ?? {}) },
    ...(o.extra ?? {}),
  };
}

/** A registry entry for a remote fixture. */
export function entry(
  /** @type {string} */ zone,
  /** @type {string} */ name,
  access = 'public',
) {
  return {
    name,
    title: name,
    path: `/${name}`,
    federationName: `${zone}_${name.replaceAll('-', '_')}`,
    package: `@org/${zone}-${name}`,
    access,
    kind: 'react',
  };
}

/**
 * @param {{
 *   catalog?: Record<string, string>,
 *   apps?: Record<string, object>,          // 'intranet/staff' → package.json
 *   packages?: Record<string, object>,      // 'ui' → package.json
 *   files?: Record<string, string | object>,
 *   exceptions?: unknown,
 *   rootMfe?: Record<string, unknown>,      // root package.json "mfe" (zones, tools)
 * }} [o]
 */
export function makeWorkspace(o = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mfe-check-'));
  created.push(root);
  const write = (/** @type {string} */ rel, /** @type {unknown} */ data) => {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      typeof data === 'string' ? data : `${JSON.stringify(data, null, 2)}\n`,
    );
  };
  const catalog = o.catalog ?? CATALOG;
  write(
    'pnpm-workspace.yaml',
    [
      'packages:',
      '  - apps/**',
      '  - packages/*',
      'catalog:',
      ...Object.entries(catalog).map(([k, v]) => `  '${k}': ${v}`),
      '',
    ].join('\n'),
  );
  write('package.json', {
    name: '@org/root',
    private: true,
    devDependencies: { typescript: 'catalog:' },
    ...(o.rootMfe ? { mfe: o.rootMfe } : {}),
  });
  const packages = o.packages ?? {
    ui: {
      name: '@org/ui',
      version: '0.1.0',
      peerDependencies: { react: '^19.0.0' },
      devDependencies: { react: 'catalog:', typescript: 'catalog:' },
    },
  };
  for (const [dir, pkg] of Object.entries(packages)) {
    write(`packages/${dir}/package.json`, pkg);
  }
  for (const [dir, pkg] of Object.entries(o.apps ?? {})) {
    write(`apps/${dir}/package.json`, pkg);
  }
  for (const [rel, content] of Object.entries(o.files ?? {})) {
    write(rel, content);
  }
  if (o.exceptions !== undefined) {
    write(
      'version-exceptions.json',
      typeof o.exceptions === 'string'
        ? o.exceptions
        : /** @type {object} */ (o.exceptions),
    );
  }
  return root;
}

/** @type {string[]} */
const created = [];

/** Delete every fixture workspace created so far (call from `after`). */
export function cleanupWorkspaces() {
  for (const dir of created.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** A valid workspace: intranet shell + 2 remotes, internet shell + 1 remote. */
export function validApps() {
  return {
    'intranet/shell-intranet': app('shell', { type: 'shell', port: 3101 }),
    'intranet/staff': app('staff', { port: 3111 }),
    'intranet/leave': app('leave', { port: 3112, access: 'private' }),
    'internet/shell-internet': app('shell', {
      zone: 'internet',
      type: 'shell',
      port: 3201,
    }),
    'internet/services': app('services', { zone: 'internet', port: 3211 }),
  };
}

export function validRegistries() {
  return {
    'apps/intranet/shell-intranet/remotes.json': {
      remotes: [
        entry('intranet', 'staff'),
        entry('intranet', 'leave', 'private'),
      ],
    },
    'apps/intranet/shell-intranet/mfe-manifest.dev.json': {
      remotes: {
        intranet_staff: { entry: 'http://localhost:3111/mf-manifest.json' },
        intranet_leave: { entry: 'http://localhost:3112/mf-manifest.json' },
      },
    },
    'apps/internet/shell-internet/remotes.json': {
      remotes: [entry('internet', 'services')],
    },
    'apps/internet/shell-internet/mfe-manifest.dev.json': {
      remotes: {
        internet_services: { entry: 'http://localhost:3211/mf-manifest.json' },
      },
    },
  };
}

/** @param {{ rule: string }[]} issues */
export const rules = (issues) => issues.map((i) => i.rule).sort();
