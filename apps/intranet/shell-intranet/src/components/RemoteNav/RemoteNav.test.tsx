import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { MainLayout, ThemeProvider } from '@org/ui';
import type { RemoteEntry } from '@/core/types/remotes';
import { RemoteNav } from './RemoteNav';

const remotes: RemoteEntry[] = [
  {
    name: 'alpha',
    title: 'Alpha',
    path: '/alpha',
    federationName: 'intranet_alpha',
    package: '@org/intranet-alpha',
    access: 'public',
    kind: 'react',
  },
  {
    name: 'beta',
    title: 'Beta',
    path: '/beta',
    federationName: 'intranet_beta',
    package: '@org/intranet-beta',
    access: 'private',
    kind: 'react',
  },
];

describe('RemoteNav', () => {
  it('always links Home', () => {
    render(
      <MemoryRouter>
        <RemoteNav remotes={[]} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute(
      'href',
      '/',
    );
  });

  it('links every registered remote to its mount path', () => {
    render(
      <MemoryRouter>
        <RemoteNav remotes={remotes} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Alpha' })).toHaveAttribute(
      'href',
      '/alpha',
    );
    expect(screen.getByRole('link', { name: 'Beta' })).toHaveAttribute(
      'data-access',
      'private',
    );
  });

  it('marks the current page (aria-current, not by colour alone)', () => {
    render(
      <MemoryRouter initialEntries={['/alpha']}>
        <RemoteNav remotes={remotes} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Alpha' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it.each(['top', 'side'] as const)(
    'follows the MainLayout nav placement (%s)',
    (placement) => {
      render(
        <ThemeProvider>
          <MemoryRouter>
            <MainLayout
              navPlacement={placement}
              nav={<RemoteNav remotes={remotes} />}
            >
              <p>content</p>
            </MainLayout>
          </MemoryRouter>
        </ThemeProvider>,
      );
      expect(screen.getByRole('list', { name: 'Apps' })).toHaveAttribute(
        'data-placement',
        placement,
      );
    },
  );

  it('is a top nav outside MainLayout', () => {
    render(
      <MemoryRouter>
        <RemoteNav remotes={remotes} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('list', { name: 'Apps' })).toHaveAttribute(
      'data-placement',
      'top',
    );
  });
});
