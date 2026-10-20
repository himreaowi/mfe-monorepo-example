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
