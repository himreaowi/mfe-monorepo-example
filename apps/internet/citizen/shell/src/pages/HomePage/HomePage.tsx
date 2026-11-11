import { Welcome } from '@/components/Welcome/Welcome';
import type { RemoteEntry } from '@/core/types/remotes';

export function HomePage({ remotes }: { remotes: RemoteEntry[] }) {
  return (
    <div data-testid="home-page">
      <Welcome remotes={remotes} />
    </div>
  );
}
