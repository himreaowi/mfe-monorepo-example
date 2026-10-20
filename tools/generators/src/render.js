// @ts-check
/** Template rendering: copy `templates/<kind>/**` with `__TOKEN__` substitution, then Prettier. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import * as prettier from 'prettier';

const require = createRequire(import.meta.url);
/** @type {import('prettier').Options} */
const prettierOptions = require('@org/prettier-config');

export const TEMPLATES_DIR = path.join(import.meta.dirname, '..', 'templates');

/** Compile-time globals of @org/webpack-config (`__MFE_BASE_PATH__`): kept as written. */
const BUILD_GLOBALS = new Set(['MFE_NAME', 'MFE_BASE_PATH']);

/**
 * Replace `__KEY__` placeholders. Unknown placeholders are an error (typo protection).
 * @param {string} text
 * @param {Record<string, string | number>} tokens
 * @param {string} source
 */
export function substitute(text, tokens, source) {
  return text.replace(/__([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*)__/g, (match, key) => {
    if (BUILD_GLOBALS.has(key)) return match;
    if (!Object.hasOwn(tokens, key)) {
      throw new Error(`Unknown template token ${match} in ${source}`);
    }
    return String(tokens[key]);
  });
}

/**
 * All template files below `dir` (relative paths).
 * @param {string} dir
 * @returns {string[]}
 */
function listFiles(dir) {
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => path.relative(dir, path.join(d.parentPath, d.name)));
}

/**
 * Format with the repo's Prettier config when Prettier knows the file type.
 * @param {string} file
 * @param {string} content
 */
export async function format(file, content) {
  const info = await prettier.getFileInfo(file, { resolveConfig: false });
  if (!info.inferredParser) return content;
  return prettier.format(content, { ...prettierOptions, filepath: file });
}

/**
 * Render one or more template layers into `targetDir` (later layers override earlier ones).
 * `.tmpl` suffixes are stripped. Returns the written paths (relative to targetDir).
 * @param {string[]} layers template folder names below templates/
 * @param {string} targetDir
 * @param {Record<string, string | number>} tokens
 * @returns {Promise<Map<string, string>>} relative path → content
 */
export async function renderLayers(layers, targetDir, tokens) {
  /** @type {Map<string, string>} */
  const files = new Map();
  for (const layer of layers) {
    const layerDir = path.join(TEMPLATES_DIR, layer);
    for (const rel of listFiles(layerDir)) {
      const source = path.join(layerDir, rel);
      const target = rel.replace(/\.tmpl$/, '');
      const content = substitute(
        fs.readFileSync(source, 'utf8'),
        tokens,
        `${layer}/${rel}`,
      );
      files.set(target, content);
    }
  }
  for (const [rel, content] of files) {
    files.set(rel, await format(path.join(targetDir, rel), content));
  }
  return files;
}

/**
 * Write files (relative path → content) below `dir`.
 * @param {string} dir
 * @param {Map<string, string>} files
 */
export function writeFiles(dir, files) {
  for (const [rel, content] of files) {
    const file = path.join(dir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
}

/**
 * Write a JSON file formatted like the rest of the repo.
 * @param {string} file
 * @param {unknown} data
 */
export async function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, await format(file, JSON.stringify(data, null, 2)));
}
