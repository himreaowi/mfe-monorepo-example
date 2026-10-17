import type { ReactNode } from 'react';

export type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  'aria-label'?: string;
  'aria-pressed'?: boolean;
  className?: string;
};
