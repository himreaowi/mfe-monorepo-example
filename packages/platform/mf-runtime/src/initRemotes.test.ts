import {
  registerPlugins,
  registerRemotes,
} from '@module-federation/enhanced/runtime';
import { initRemotes, resetRemote } from './initRemotes';
import { remoteCssPlugin } from './remoteCss';

jest.mock('@module-federation/enhanced/runtime', () => ({
  registerRemotes: jest.fn(),
  registerPlugins: jest.fn(),
  loadRemote: jest.fn(),
}));

describe('initRemotes', () => {
  it('registers every manifest remote with an absolute entry URL', () => {
    const remotes = initRemotes({
      remotes: {
        a: { entry: 'http://localhost:3101/mf-manifest.json' },
        b: { entry: '/remotes/b/mf-manifest.json' },
      },
    });
    const expected = [
      { name: 'a', entry: 'http://localhost:3101/mf-manifest.json' },
      { name: 'b', entry: 'http://localhost/remotes/b/mf-manifest.json' },
    ];
    expect(remotes).toEqual(expected);
    expect(registerRemotes).toHaveBeenCalledWith(expected, {
      force: undefined,
    });
    // CSS of remotes is left to their chunk loader (see remoteCss.ts)
    expect(registerPlugins).toHaveBeenCalledWith([remoteCssPlugin]);
  });

  it('resetRemote force-registers one remote', () => {
    resetRemote({ name: 'a', entry: 'http://x/mf-manifest.json' });
    expect(registerRemotes).toHaveBeenLastCalledWith(
      [{ name: 'a', entry: 'http://x/mf-manifest.json' }],
      { force: true },
    );
  });
});
