import { Badge } from '@org/ui';

/**
 * Shows whether the remote runs inside a shell or standalone. An app-level component that
 * composes an @org/ui one: the look comes from the library, the wording from this app.
 */
export function ModeBadge({ embedded }: { embedded: boolean }) {
  return (
    <Badge variant="accent" data-testid="mode-badge">
      {embedded ? 'Embedded in the shell' : 'Standalone mode'}
    </Badge>
  );
}
