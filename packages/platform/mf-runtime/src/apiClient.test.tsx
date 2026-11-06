import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MfeManifestProvider } from './ManifestContext';
import type { MfeManifest } from './manifest/manifest';
import { HostPropsProvider } from './remote/HostPropsContext';
import { useApiClient as useRemoteApiClient } from './remote/useApiClient';
import { useApiClient as useShellApiClient } from './useManifestApiClient';

function hostProps(settings?: Record<string, unknown>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <HostPropsProvider value={{ embedded: true, basePath: '/x', settings }}>
        {children}
      </HostPropsProvider>
    );
  };
}

describe('useApiClient (remote)', () => {
  it('builds the client from host props settings.apiBaseUrl', () => {
    const { result } = renderHook(() => useRemoteApiClient(), {
      wrapper: hostProps({ apiBaseUrl: 'http://api.test/api' }),
    });
    expect(result.current?.url('/items')).toBe('http://api.test/api/items');
  });

  it('is undefined without settings.apiBaseUrl', () => {
    const { result } = renderHook(() => useRemoteApiClient(), {
      wrapper: hostProps({}),
    });
    expect(result.current).toBeUndefined();
  });

  it('keeps the same client while the base URL stays the same', () => {
    const { result, rerender } = renderHook(() => useRemoteApiClient(), {
      wrapper: hostProps({ apiBaseUrl: '/api' }),
    });
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});

describe('useApiClient (shell)', () => {
  it('builds the client from the manifest settings.apiBaseUrl', () => {
    const manifest = {
      remotes: {},
      settings: { apiBaseUrl: '/api' },
    } as MfeManifest;
    const { result } = renderHook(() => useShellApiClient(), {
      wrapper: ({ children }) => (
        <MfeManifestProvider manifest={manifest}>
          {children}
        </MfeManifestProvider>
      ),
    });
    expect(result.current?.url('/items')).toBe('/api/items');
  });

  it('is undefined outside MfeManifestProvider', () => {
    const { result } = renderHook(() => useShellApiClient());
    expect(result.current).toBeUndefined();
  });
});

describe('useApiClient 401 handling', () => {
  const unauthorized = () =>
    jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response(null, { status: 401 }));

  beforeEach(() => {
    // jsdom has no fetch of its own (@org/jest-config)
    globalThis.fetch ??= (() => {
      throw new Error('not mocked');
    }) as typeof fetch;
  });
  afterEach(() => jest.restoreAllMocks());

  it('remote: a 401 calls host prop onUnauthorized, the latest one', async () => {
    unauthorized();
    const first = jest.fn();
    const second = jest.fn();
    let onUnauthorized = first;
    const { result, rerender } = renderHook(() => useRemoteApiClient(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <HostPropsProvider
          value={{
            embedded: true,
            basePath: '/x',
            settings: { apiBaseUrl: '/api' },
            onUnauthorized,
          }}
        >
          {children}
        </HostPropsProvider>
      ),
    });
    const client = result.current;
    onUnauthorized = second;
    rerender();
    expect(result.current).toBe(client);
    await expect(client?.getJson('/me')).rejects.toMatchObject({ status: 401 });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('shell: a 401 calls onUnauthorized of the manifest provider', async () => {
    unauthorized();
    const onUnauthorized = jest.fn();
    const manifest = {
      remotes: {},
      settings: { apiBaseUrl: '/api' },
    } as MfeManifest;
    const { result } = renderHook(() => useShellApiClient(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <MfeManifestProvider
          manifest={manifest}
          onUnauthorized={onUnauthorized}
        >
          {children}
        </MfeManifestProvider>
      ),
    });
    await expect(result.current?.getJson('/me')).rejects.toMatchObject({
      status: 401,
    });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});
