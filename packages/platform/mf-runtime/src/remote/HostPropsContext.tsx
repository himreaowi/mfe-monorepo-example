import { createContext, useContext, type ReactNode } from 'react';
import { joinBasePath, type HostProps } from '../hostProps';

const STANDALONE: HostProps = { embedded: false, basePath: '/' };

const HostPropsContext = createContext<HostProps>(STANDALONE);
HostPropsContext.displayName = 'HostPropsContext';

export function HostPropsProvider({
  value,
  children,
}: {
  value: HostProps;
  children: ReactNode;
}) {
  return (
    <HostPropsContext.Provider value={value}>
      {children}
    </HostPropsContext.Provider>
  );
}

/** Props from the shell (or the standalone mock props). */
export function useHostProps<T extends HostProps = HostProps>(): T {
  return useContext(HostPropsContext) as T;
}

/**
 * Absolute path inside this remote: `useRemotePath('route-2')` → `/apps/staff/route-2` in a
 * shell, `/route-2` standalone. Use it for links between remote pages: relative links inside a
 * shell's splat route resolve against the splat and are easy to get wrong.
 */
export function useRemotePath(): (to: string) => string {
  const { basePath } = useHostProps();
  return (to: string) => joinBasePath(basePath, to);
}
