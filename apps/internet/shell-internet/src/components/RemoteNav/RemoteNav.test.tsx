import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { RemoteEntry } from '@/core/types/remotes';
import { RemoteNav } from './RemoteNav';

const remotes: RemoteEntry[] = [
  {
    name: 'alpha',
    title: 'Alpha',
    path: '/alpha',
    federationName: 'internet_alpha',
    package: '@org/internet-alpha',
    access: 'public',
    kind: 'react',
  },
  {
    name: 'beta',
    title: 'Beta',
    path: '/beta',
    federationName: 'internet_beta',
    package: '@org/internet-beta',
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

  it('is horizontal by default', () => {
    render(
      <MemoryRouter>
        <RemoteNav remotes={remotes} />
      </MemoryRouter>,
    );
    const list = screen.getByRole('list', { name: 'Apps' });
    expect(list).toHaveAttribute('data-orientation', 'horizontal');
    expect(list).not.toHaveClass('vertical');
  });

  it('stacks its links when vertical (sidebar, drawer)', () => {
    render(
      <MemoryRouter>
        <RemoteNav remotes={remotes} orientation="vertical" />
      </MemoryRouter>,
    );
    const list = screen.getByRole('list', { name: 'Apps' });
    expect(list).toHaveAttribute('data-orientation', 'vertical');
    expect(list).toHaveClass('vertical');
  });
});
