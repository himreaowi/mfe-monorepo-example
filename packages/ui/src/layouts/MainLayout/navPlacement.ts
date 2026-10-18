import { createContext, useContext } from 'react';

/**
 * Where `MainLayout` shows its `nav`: `top` = in the header row (default), `side` = a vertical
 * sidebar left of the content on wide screens. Both collapse behind the "Menu" button when
 * there is not enough room.
 */
export type NavPlacement = 'top' | 'side';

/** @internal provided by `MainLayout` around its header (nav and header actions). */
export const NavPlacementContext = createContext<NavPlacement>('top');

/**
 * The placement of the `MainLayout` nav this component is rendered in (`top` outside a
 * `MainLayout`). For nav content that adapts, e.g. the shell's `RemoteNav` stacks its links
 * and marks the active one with a bar in the sidebar.
 */
export function useNavPlacement(): NavPlacement {
  return useContext(NavPlacementContext);
}
