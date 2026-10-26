// Storybook for @org/ui: DEV ONLY (`pnpm storybook`, `pnpm build-storybook`). Nothing here is
// imported by the library, so it never reaches an app bundle.
// Same loaders as the apps (@org/webpack-config, not imported: it depends on @org/ui):
// swc-loader for TS/TSX, sass-loader → css-loader (CSS Modules with readable
// `<Component>_<class>__<hash>` names) → mini-css-extract-plugin, so stories look exactly like
// the components in an app.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/react-webpack5';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import * as sass from 'sass';

const require = createRequire(import.meta.url);

/**
 * Absolute folder of a package installed for @org/ui. pnpm's isolated layout links only the
 * declared dependencies next to this package, so Storybook (installed elsewhere in the store)
 * cannot find the framework by its bare name.
 */
const packageDir = (name: string) =>
  path.dirname(fileURLToPath(import.meta.resolve(`${name}/package.json`)));

/** css-loader's own class name function (no type declarations). */
const { defaultGetLocalIdent } = require('css-loader') as {
  defaultGetLocalIdent: (
    context: unknown,
    name: string,
    local: string,
    options: unknown,
  ) => string;
};

/** `Button.module.scss` `.button` → `Button_button__x3Yb1`, as getLocalIdent in @org/webpack-config. */
function getLocalIdent(
  context: { resourcePath: string },
  localIdentName: string,
  localName: string,
  options: unknown,
) {
  const component = path
    .basename(context.resourcePath)
    .replace(/(\.module)?\.s?css$/, '');
  return defaultGetLocalIdent(
    context,
    localIdentName
      .replace(/\[name\]/gi, component)
      .replace(/\[local\]/gi, localName),
    localName,
    options,
  );
}

const styleLoaders = (modules: boolean) => [
  { loader: MiniCssExtractPlugin.loader },
  {
    loader: require.resolve('css-loader'),
    options: {
      importLoaders: 1,
      modules: modules
        ? {
            namedExport: false,
            exportLocalsConvention: 'as-is',
            localIdentName: '[name]_[local]__[hash:base64:5]',
            getLocalIdent,
            localIdentHashSalt: 'storybook',
          }
        : false,
    },
  },
  {
    loader: require.resolve('sass-loader'),
    options: { implementation: sass, api: 'modern' },
  },
];

const config: StorybookConfig = {
  framework: { name: packageDir('@storybook/react-webpack5'), options: {} },
  stories: ['../src/**/*.stories.tsx'],
  addons: [],
  core: { disableTelemetry: true, disableWhatsNewNotifications: true },
  // Prop tables are not used (no docs addon); skip the react-docgen pass.
  typescript: { reactDocgen: false },
  webpackFinal: (webpackConfig) => {
    webpackConfig.module ??= {};
    webpackConfig.module.rules = [
      ...(webpackConfig.module.rules ?? []),
      {
        test: /\.[cm]?tsx?$/,
        exclude: /node_modules/,
        loader: require.resolve('swc-loader'),
        options: {
          jsc: {
            target: 'es2022',
            parser: { syntax: 'typescript', tsx: true },
            transform: { react: { runtime: 'automatic' } },
          },
        },
        type: 'javascript/auto',
      },
      {
        test: /\.module\.scss$/,
        use: styleLoaders(true),
        type: 'javascript/auto',
      },
      {
        test: /\.scss$/,
        exclude: /\.module\.scss$/,
        use: styleLoaders(false),
      },
    ];
    webpackConfig.plugins = [
      ...(webpackConfig.plugins ?? []),
      new MiniCssExtractPlugin(),
    ];
    // a dev tool: bundle size hints are noise here
    webpackConfig.performance = { hints: false };
    return webpackConfig;
  },
};

export default config;
