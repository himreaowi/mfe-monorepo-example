// Fixture: proves library.json compiles a typed, exported component.
import type { ReactNode } from 'react';

export interface BoxProps {
  children: ReactNode;
}

export const Box = ({ children }: BoxProps) => <div>{children}</div>;
