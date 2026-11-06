import { registerPlugins } from '@module-federation/enhanced/runtime';
import { registerRemoteCssPlugin, remoteCssPlugin } from './remoteCss';

jest.mock('@module-federation/enhanced/runtime', () => ({
  registerPlugins: jest.fn(),
}));

type PreloadOp = { filter?: (url: string) => boolean };

async function runHook(preloadOps: PreloadOp[]) {
  const hook = remoteCssPlugin.beforePreloadRemote as unknown as (args: {
    preloadOps: PreloadOp[];
  }) => unknown;
  await hook({ preloadOps });
  return preloadOps;
}

describe('remoteCssPlugin', () => {
  it('drops .css files from the preloads loadRemote starts, keeps JS', async () => {
    const [op] = await runHook([{}]);
    const filter = op!.filter!;
    expect(
      filter('http://localhost:3101/__federation_expose_App.0a1b2c3d.css'),
    ).toBe(false);
    expect(filter('https://cdn.example/remote/735.0a1b2c3d.css?v=1')).toBe(
      false,
    );
    expect(
      filter('http://localhost:3101/__federation_expose_App.0a1b2c3d.js'),
    ).toBe(true);
    expect(filter('http://localhost:3101/remoteEntry.js')).toBe(true);
  });

  it('keeps an existing filter', async () => {
    const [op] = await runHook([{ filter: (url) => !url.includes('skip') }]);
    expect(op!.filter!('https://x.example/skip.js')).toBe(false);
    expect(op!.filter!('https://x.example/a.js')).toBe(true);
    expect(op!.filter!('https://x.example/a.css')).toBe(false);
  });

  it('registerRemoteCssPlugin registers it with the federation runtime', () => {
    registerRemoteCssPlugin();
    expect(registerPlugins).toHaveBeenCalledWith([remoteCssPlugin]);
    expect(remoteCssPlugin.name).toBe('org-remote-css-from-chunk-loader');
  });
});
