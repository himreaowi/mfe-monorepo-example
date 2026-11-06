import type { ComponentType, ReactElement, ReactNode } from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import {
  render,
  renderHook,
  type RenderHookOptions,
  type RenderHookResult,
  type RenderOptions,
  type RenderResult,
} from '@testing-library/react';
import { createQueryClient } from './createQueryClient';

/** The app defaults without retries, so a failing request fails the test at once. */
export function createTestQueryClient(): QueryClient {
  const client = createQueryClient();
  client.setDefaultOptions({
    ...client.getDefaultOptions(),
    queries: { ...client.getDefaultOptions().queries, retry: false },
  });
  return client;
}

type QueryOptions = {
  /** Pass one to look at the cache from the test. Default: a new client for this render. */
  queryClient?: QueryClient;
};

function withQuery(
  client: QueryClient,
  Inner: ComponentType<{ children: ReactNode }> | undefined,
) {
  return function QueryTestWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        {Inner ? <Inner>{children}</Inner> : children}
      </QueryClientProvider>
    );
  };
}

/** `render` inside a fresh QueryClient. A `wrapper` option (host props) goes inside it. */
export function renderWithQuery(
  ui: ReactElement,
  {
    queryClient = createTestQueryClient(),
    wrapper,
    ...options
  }: QueryOptions & RenderOptions = {},
): RenderResult & { queryClient: QueryClient } {
  const result = render(ui, {
    ...options,
    wrapper: withQuery(
      queryClient,
      wrapper as ComponentType<{ children: ReactNode }> | undefined,
    ),
  });
  return { ...result, queryClient };
}

/** `renderHook` inside a fresh QueryClient. A `wrapper` option (host props) goes inside it. */
export function renderHookWithQuery<Result, Props>(
  hook: (props: Props) => Result,
  {
    queryClient = createTestQueryClient(),
    wrapper,
    ...options
  }: QueryOptions & RenderHookOptions<Props> = {},
): RenderHookResult<Result, Props> & { queryClient: QueryClient } {
  const result = renderHook(hook, {
    ...options,
    wrapper: withQuery(
      queryClient,
      wrapper as ComponentType<{ children: ReactNode }> | undefined,
    ),
  });
  return { ...result, queryClient };
}
